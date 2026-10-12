import { ApiError, SessionExpiredError, toApiError } from './errors';

export const CSRF_HEADER = 'X-CSRF-TOKEN';
const UNSAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT']);

export type HttpMethod = 'GET' | 'POST' | 'PUT';
type QueryValue = string | number | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Do not try to refresh the session on 401. Used by auth endpoints
   * themselves — most importantly by rotate, so it never triggers a rotate.
   */
  skipSessionRefresh?: boolean;
}

export interface HttpClientConfig {
  baseUrl: string;
  /** Refreshes the server-side session (POST /auth/token/rotate). */
  rotateSession: () => Promise<void>;
  /** Called when the session cannot be recovered; must be idempotent. */
  onSessionExpired: () => void;
  fetch?: typeof fetch;
}

export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

/**
 * Transport layer: CSRF bootstrap, 419 retry, 401 → rotate → retry.
 *
 * Retry policy per request: at most one CSRF retry (419) and at most one
 * session retry (401). Concurrent 401s share a single in-flight rotate.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);

  let csrfToken: string | null = null;
  let csrfRequest: Promise<string> | null = null;

  let rotation: Promise<void> | null = null;
  /** Incremented after each successful rotate. */
  let sessionEpoch = 0;

  function buildUrl(path: string, query?: Record<string, QueryValue>): URL {
    const url = new URL(path, config.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    return url;
  }

  async function fetchCsrfToken(): Promise<string> {
    const response = await fetchImpl(buildUrl('/csrf'), {
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    });
    if (!response.ok) throw await toApiError(response);

    const token = response.headers.get(CSRF_HEADER);
    if (!token) throw new ApiError(response.status, 'UnknownError', 'CSRF token is missing');
    return token;
  }

  /** Returns the cached token or fetches it once for all concurrent callers. */
  function ensureCsrfToken(): Promise<string> {
    if (csrfToken) return Promise.resolve(csrfToken);
    csrfRequest ??= fetchCsrfToken()
      .then((token) => {
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfRequest = null;
      });
    return csrfRequest;
  }

  /** Drops the token only if nobody has replaced it yet (concurrent 419s). */
  function invalidateCsrfToken(staleToken: string): void {
    if (csrfToken === staleToken) csrfToken = null;
  }

  /** Single-flight rotate: every caller during a rotation awaits the same promise. */
  function refreshSession(): Promise<void> {
    rotation ??= config
      .rotateSession()
      .then(() => {
        sessionEpoch += 1;
      })
      .finally(() => {
        rotation = null;
      });
    return rotation;
  }

  function expireSession(): never {
    config.onSessionExpired();
    throw new SessionExpiredError();
  }

  async function parseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    let csrfRetried = false;
    let sessionRetried = false;

    for (;;) {
      const token = await ensureCsrfToken();
      const epochAtSend = sessionEpoch;

      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
        ...options.headers,
      };
      if (UNSAFE_METHODS.has(method)) headers[CSRF_HEADER] = token;
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetchImpl(buildUrl(path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
        credentials: 'same-origin',
      });

      if (response.status === 419 && !csrfRetried) {
        csrfRetried = true;
        invalidateCsrfToken(token);
        continue;
      }

      if (response.status === 401 && !options.skipSessionRefresh) {
        if (sessionRetried) expireSession();
        sessionRetried = true;

        // If a rotate already completed after this request was sent, the
        // 401 is stale — retry with the fresh session instead of rotating again.
        if (epochAtSend === sessionEpoch) {
          try {
            await refreshSession();
          } catch {
            expireSession();
          }
        }
        continue;
      }

      if (!response.ok) throw await toApiError(response);
      return parseBody<T>(response);
    }
  }

  return { request };
}
