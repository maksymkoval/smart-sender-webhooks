import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../mocks/backend';
import { createHandlers } from '../mocks/handlers';
import { TEST_CREDENTIALS } from '../mocks/seed';
import { createApi, type Api } from './createApi';
import { SessionExpiredError } from './errors';

const BASE_URL = 'http://localhost';
const FINGERPRINT = '0123456789abcdef0123456789abcdef';

let backend = new MockBackend();
const server = setupServer();

/** "METHOD /path STATUS" for every response the mock produced, in order. */
let log: string[] = [];
server.events.on('response:mocked', ({ request, response }) => {
  log.push(`${request.method} ${new URL(request.url).pathname} ${response.status}`);
});

const callsTo = (fragment: string) => log.filter((entry) => entry.includes(fragment));

async function signIn(api: Api): Promise<void> {
  const { device_session_token } = await api.auth.login(TEST_CREDENTIALS);
  await api.auth.issue(device_session_token);
}

let api: Api;
let onSessionExpired: ReturnType<typeof vi.fn<() => void>>;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(async () => {
  backend = new MockBackend();
  server.resetHandlers(...createHandlers(backend));
  onSessionExpired = vi.fn<() => void>();
  api = createApi({ baseUrl: BASE_URL, getFingerprint: () => FINGERPRINT, onSessionExpired });
  await signIn(api);
  log = [];
});

afterEach(() => server.resetHandlers());

describe('session refresh', () => {
  it('two parallel requests with 401 share one rotate and both succeed on retry', async () => {
    // Slow rotate down so both 401s are guaranteed to arrive while it is in flight;
    // returning nothing falls through to the real mock handler.
    server.use(
      http.post('*/auth/token/rotate', async () => {
        await delay(50);
      }),
    );
    backend.expireSession();

    const [list, webhook] = await Promise.all([api.webhooks.list({ page: 1 }), api.webhooks.get(3)]);

    expect(list.data).toHaveLength(10);
    expect(webhook.id).toBe(3);

    expect(callsTo('/auth/token/rotate')).toEqual(['POST /auth/token/rotate 200']);
    expect(callsTo('/v1/webhooks').sort()).toEqual(
      [
        'GET /v1/webhooks 401',
        'GET /v1/webhooks 200',
        'GET /v1/webhooks/3 401',
        'GET /v1/webhooks/3 200',
      ].sort(),
    );
    // Both 401s happened before the single rotate, both retries after it.
    const rotateIndex = log.indexOf('POST /auth/token/rotate 200');
    expect(log.slice(0, rotateIndex).filter((entry) => entry.endsWith('401'))).toHaveLength(2);
    expect(log.slice(rotateIndex + 1).filter((entry) => entry.endsWith('200'))).toHaveLength(2);

    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('ends the local session when rotate fails, without retrying rotate', async () => {
    backend.revoke(); // server forgot the session → rotate answers 400

    const results = await Promise.allSettled([api.auth.me(), api.webhooks.list({ page: 1 })]);

    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(SessionExpiredError);
    }
    expect(callsTo('/auth/token/rotate')).toEqual(['POST /auth/token/rotate 400']);
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('refetches the CSRF token once on 419 and retries the request', async () => {
    server.use(
      http.put('*/v1/webhooks/:id', () => HttpResponse.json({}, { status: 419 }), { once: true }),
    );

    const updated = await api.webhooks.update(1, { name: 'Renamed', url: 'https://example.com/hook' });

    expect(updated.name).toBe('Renamed');
    expect(callsTo('/csrf')).toEqual(['GET /csrf 204']);
    expect(callsTo('/v1/webhooks/1')).toEqual(['PUT /v1/webhooks/1 419', 'PUT /v1/webhooks/1 200']);
  });
});
