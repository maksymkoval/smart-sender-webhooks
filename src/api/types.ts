/** Types that mirror the API contract one-to-one. */

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
}

export interface Webhook {
  id: number;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
}

export interface Paging {
  pages: { current: number; last: number };
  results: { total: number; limitation: number };
}

export interface Paginated<T> {
  data: T[];
  paging: Paging;
}

export type WebhookList = Paginated<Webhook>;

export interface WebhookListQuery {
  page: number;
  search?: string;
}

export interface WebhookUpdate {
  name: string;
  url: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  device_session_token: string;
}

export type ApiErrorType =
  | 'BadRequestException'
  | 'AuthenticationException'
  | 'NotFoundException'
  | 'TokenMismatchException'
  | 'ValidationException';

/** Field name → list of messages (only for ValidationException). */
export type FieldErrors = Record<string, string[]>;

export interface ApiErrorBody {
  error: {
    type: ApiErrorType;
    message: string;
    payload?: FieldErrors;
  };
}
