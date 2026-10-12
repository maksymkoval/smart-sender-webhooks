import type { HttpClient } from './http';
import type {
  LoginCredentials,
  LoginResponse,
  User,
  Webhook,
  WebhookList,
  WebhookListQuery,
  WebhookUpdate,
} from './types';

export const WEBHOOKS_PAGE_SIZE = 10;

/**
 * The contract requires X-Captcha-Token on login. A real captcha widget would
 * produce this value; the mock accepts any non-empty string.
 */
const CAPTCHA_STUB_TOKEN = 'captcha-stub';

export function createAuthApi(http: HttpClient, getFingerprint: () => string) {
  return {
    login(credentials: LoginCredentials): Promise<LoginResponse> {
      return http.request('/auth/login', {
        method: 'POST',
        body: { ...credentials, fingerprint: getFingerprint() },
        headers: { 'X-Captcha-Token': CAPTCHA_STUB_TOKEN },
        skipSessionRefresh: true,
      });
    },

    issue(deviceSessionToken: string): Promise<void> {
      return http.request('/auth/token/issue', {
        method: 'POST',
        body: { device_session_token: deviceSessionToken, fingerprint: getFingerprint() },
        skipSessionRefresh: true,
      });
    },

    rotate(): Promise<void> {
      return http.request('/auth/token/rotate', {
        method: 'POST',
        body: { fingerprint: getFingerprint() },
        skipSessionRefresh: true,
      });
    },

    revoke(): Promise<void> {
      return http.request('/auth/token/revoke', {
        method: 'POST',
        body: { fingerprint: getFingerprint() },
        skipSessionRefresh: true,
      });
    },

    me(signal?: AbortSignal): Promise<User> {
      return http.request('/v1/me', { signal });
    },
  };
}

export function createWebhooksApi(http: HttpClient) {
  return {
    list({ page, search }: WebhookListQuery, signal?: AbortSignal): Promise<WebhookList> {
      return http.request('/v1/webhooks', {
        query: { page, limit: WEBHOOKS_PAGE_SIZE, search },
        signal,
      });
    },

    get(id: number, signal?: AbortSignal): Promise<Webhook> {
      return http.request(`/v1/webhooks/${id}`, { signal });
    },

    update(id: number, data: WebhookUpdate): Promise<Webhook> {
      return http.request(`/v1/webhooks/${id}`, { method: 'PUT', body: data });
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
export type WebhooksApi = ReturnType<typeof createWebhooksApi>;
