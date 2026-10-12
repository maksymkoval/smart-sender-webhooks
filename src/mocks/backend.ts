import type { ApiErrorType, FieldErrors, Webhook, WebhookList, WebhookUpdate } from '../api/types';
import { MOCK_USER, TEST_CREDENTIALS, seedWebhooks } from './seed';

export const SESSION_TTL_MS = 30_000;
export const MOCK_CSRF_TOKEN = 'mock-csrf-7f3c2a9e1b';
const PAGE_SIZE = 10;

const STATUS_BY_TYPE: Record<ApiErrorType, number> = {
  BadRequestException: 400,
  AuthenticationException: 401,
  NotFoundException: 404,
  TokenMismatchException: 419,
  ValidationException: 422,
};

/** Error that the handler layer turns into the contract error response. */
export class MockHttpError extends Error {
  readonly status: number;

  constructor(
    readonly type: ApiErrorType,
    message: string,
    readonly payload?: FieldErrors,
  ) {
    super(message);
    this.status = STATUS_BY_TYPE[type];
  }
}

const validationError = (payload: FieldErrors) =>
  new MockHttpError('ValidationException', 'The given data was invalid.', payload);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

interface Session {
  fingerprint: string;
  expiresAt: number;
}

/**
 * Pure in-memory "server". The session lives here — the client never sees
 * session tokens, which is how an HttpOnly cookie behaves.
 */
export class MockBackend {
  private webhooks: Webhook[] = seedWebhooks();
  /** device_session_token → fingerprint; one-time tokens from /auth/login. */
  private deviceTokens = new Map<string, string>();
  private session: Session | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  // --- CSRF ---------------------------------------------------------------

  assertCsrf(token: string | null): void {
    if (token !== MOCK_CSRF_TOKEN) {
      throw new MockHttpError('TokenMismatchException', 'CSRF token mismatch.');
    }
  }

  // --- Auth ---------------------------------------------------------------

  login(input: { email?: unknown; password?: unknown; fingerprint?: unknown }, captcha: string | null) {
    const errors: FieldErrors = {};
    if (!captcha) errors.captcha = ['The captcha token is required.'];
    if (typeof input.email !== 'string' || !input.email.trim()) {
      errors.email = ['The email field is required.'];
    }
    if (typeof input.password !== 'string' || !input.password) {
      errors.password = ['The password field is required.'];
    }
    if (typeof input.fingerprint !== 'string' || !input.fingerprint) {
      errors.fingerprint = ['The fingerprint field is required.'];
    }
    if (Object.keys(errors).length > 0) throw validationError(errors);

    if (input.email !== TEST_CREDENTIALS.email || input.password !== TEST_CREDENTIALS.password) {
      throw validationError({ password: ['These credentials do not match our records.'] });
    }

    const token = crypto.randomUUID();
    this.deviceTokens.set(token, input.fingerprint as string);
    return { device_session_token: token };
  }

  issue(input: { device_session_token?: unknown; fingerprint?: unknown }): void {
    const token = input.device_session_token;
    const fingerprint = typeof token === 'string' ? this.deviceTokens.get(token) : undefined;
    if (!fingerprint || fingerprint !== input.fingerprint) {
      throw validationError({ device_session_token: ['The device session token is invalid.'] });
    }
    this.deviceTokens.delete(token as string);
    this.session = { fingerprint, expiresAt: this.now() + SESSION_TTL_MS };
  }

  /** Works on an expired session too — that is the whole point of rotate. */
  rotate(input: { fingerprint?: unknown }): void {
    if (!this.session || this.session.fingerprint !== input.fingerprint) {
      throw new MockHttpError('BadRequestException', 'No session to rotate.');
    }
    this.session.expiresAt = this.now() + SESSION_TTL_MS;
  }

  revoke(): void {
    this.session = null;
  }

  assertAuthenticated(): void {
    if (!this.session || this.session.expiresAt <= this.now()) {
      throw new MockHttpError('AuthenticationException', 'Unauthenticated.');
    }
  }

  me() {
    this.assertAuthenticated();
    return MOCK_USER;
  }

  /** Test helper: make the next protected request return 401. */
  expireSession(): void {
    if (this.session) this.session.expiresAt = this.now() - 1;
  }

  // --- Webhooks -----------------------------------------------------------

  listWebhooks(params: { page: number; limit: number; search: string }): WebhookList {
    this.assertAuthenticated();

    const limit = params.limit > 0 ? Math.min(params.limit, 100) : PAGE_SIZE;
    const page = Math.max(1, params.page || 1);
    const needle = params.search.trim().toLowerCase();

    const filtered = needle
      ? this.webhooks.filter((webhook) => webhook.name.toLowerCase().includes(needle))
      : this.webhooks;

    const start = (page - 1) * limit;
    return {
      data: filtered.slice(start, start + limit),
      paging: {
        pages: { current: page, last: Math.max(1, Math.ceil(filtered.length / limit)) },
        results: { total: filtered.length, limitation: limit },
      },
    };
  }

  getWebhook(id: number): Webhook {
    this.assertAuthenticated();
    const webhook = this.webhooks.find((item) => item.id === id);
    if (!webhook) throw new MockHttpError('NotFoundException', 'Webhook not found.');
    return webhook;
  }

  updateWebhook(id: number, input: Partial<Record<keyof WebhookUpdate, unknown>>): Webhook {
    const current = this.getWebhook(id);

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const url = typeof input.url === 'string' ? input.url.trim() : '';

    const errors: FieldErrors = {};
    if (!name) errors.name = ['The name field is required.'];
    else if (name.length > 255) errors.name = ['The name may not be greater than 255 characters.'];
    if (!url) errors.url = ['The url field is required.'];
    else if (!isHttpUrl(url)) errors.url = ['The url must be a valid URL.'];
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const updated: Webhook = { ...current, name, url };
    this.webhooks = this.webhooks.map((item) => (item.id === id ? updated : item));
    return updated;
  }
}
