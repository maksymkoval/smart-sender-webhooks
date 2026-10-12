import { createAuthApi, createWebhooksApi } from './endpoints';
import { createHttpClient } from './http';

export interface ApiConfig {
  baseUrl: string;
  getFingerprint: () => string;
  onSessionExpired: () => void;
  fetch?: typeof fetch;
}

/** Wires the transport and endpoint modules together. No React, no globals. */
export function createApi(config: ApiConfig) {
  const http = createHttpClient({
    baseUrl: config.baseUrl,
    fetch: config.fetch,
    onSessionExpired: config.onSessionExpired,
    // Late-bound: `auth` is defined below; rotate goes through the same
    // transport (CSRF, 419 retry) but never triggers another rotate.
    rotateSession: () => auth.rotate(),
  });

  const auth = createAuthApi(http, config.getFingerprint);
  const webhooks = createWebhooksApi(http);

  return { auth, webhooks };
}

export type Api = ReturnType<typeof createApi>;
