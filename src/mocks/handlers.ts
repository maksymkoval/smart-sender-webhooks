import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import type { ApiErrorBody } from '../api/types';
import { MOCK_CSRF_TOKEN, MockBackend, MockHttpError } from './backend';

interface HandlerOptions {
  /** Artificial latency, so loading states are visible in the browser. */
  latencyMs?: number;
}

interface GuardOptions {
  csrf?: boolean;
}

function errorResponse(error: MockHttpError) {
  const body: ApiErrorBody = {
    error: {
      type: error.type,
      message: error.message,
      ...(error.payload ? { payload: error.payload } : {}),
    },
  };
  return HttpResponse.json(body, { status: error.status });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createHandlers(backend: MockBackend, { latencyMs = 0 }: HandlerOptions = {}) {
  /** Common checks every endpoint runs before its own logic. */
  const guarded =
    (resolver: HttpResponseResolver, { csrf = false }: GuardOptions = {}): HttpResponseResolver =>
    async (info) => {
      if (latencyMs > 0) await delay(latencyMs);
      try {
        if (info.request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
          throw new MockHttpError('BadRequestException', 'X-Requested-With header is required.');
        }
        if (csrf) backend.assertCsrf(info.request.headers.get('X-CSRF-TOKEN'));
        return await resolver(info);
      } catch (error) {
        if (error instanceof MockHttpError) return errorResponse(error);
        throw error;
      }
    };

  const parseId = (raw: string | readonly string[] | undefined): number => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new MockHttpError('NotFoundException', 'Webhook not found.');
    }
    return id;
  };

  return [
    http.get(
      '*/csrf',
      guarded(() => new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': MOCK_CSRF_TOKEN } })),
    ),

    http.post(
      '*/auth/login',
      guarded(
        async ({ request }) =>
          HttpResponse.json(backend.login(await readJson(request), request.headers.get('X-Captcha-Token'))),
        { csrf: true },
      ),
    ),

    http.post(
      '*/auth/token/issue',
      guarded(
        async ({ request }) => {
          backend.issue(await readJson(request));
          return new HttpResponse(null, { status: 200 });
        },
        { csrf: true },
      ),
    ),

    http.post(
      '*/auth/token/rotate',
      guarded(
        async ({ request }) => {
          backend.rotate(await readJson(request));
          return new HttpResponse(null, { status: 200 });
        },
        { csrf: true },
      ),
    ),

    http.post(
      '*/auth/token/revoke',
      guarded(
        () => {
          backend.revoke();
          return new HttpResponse(null, { status: 204 });
        },
        { csrf: true },
      ),
    ),

    http.get(
      '*/v1/me',
      guarded(() => HttpResponse.json(backend.me())),
    ),

    http.get(
      '*/v1/webhooks',
      guarded(({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json(
          backend.listWebhooks({
            page: Number(params.get('page') ?? 1),
            limit: Number(params.get('limit') ?? 10),
            search: params.get('search') ?? '',
          }),
        );
      }),
    ),

    http.get(
      '*/v1/webhooks/:id',
      guarded(({ params }) => HttpResponse.json(backend.getWebhook(parseId(params.id)))),
    ),

    http.put(
      '*/v1/webhooks/:id',
      guarded(
        async ({ params, request }) =>
          HttpResponse.json(backend.updateWebhook(parseId(params.id), await readJson(request))),
        { csrf: true },
      ),
    ),
  ];
}
