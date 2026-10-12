import type { ApiErrorBody, ApiErrorType, FieldErrors } from './types';

/** Any non-2xx response, normalised to the contract's error format. */
export class ApiError extends Error {
  readonly status: number;
  readonly type: ApiErrorType | 'UnknownError';
  readonly fieldErrors: FieldErrors;

  constructor(
    status: number,
    type: ApiError['type'],
    message: string,
    fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.fieldErrors = fieldErrors;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/**
 * Thrown when the session could not be refreshed (rotate failed, or the
 * retried request got 401 again). The local session is already terminated
 * by the time callers see it, so UI should not render it as a regular error.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body — fall back to the status text.
  }

  if (isApiErrorBody(body)) {
    const { type, message, payload } = body.error;
    return new ApiError(response.status, type, message, payload ?? {});
  }

  return new ApiError(
    response.status,
    'UnknownError',
    response.statusText || `Request failed with status ${response.status}`,
  );
}
