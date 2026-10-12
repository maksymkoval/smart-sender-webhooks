import { setupWorker } from 'msw/browser';
import { MockBackend } from './backend';
import { createHandlers } from './handlers';

/** State lives in page memory, so a reload resets the "server" (and the session). */
export const backend = new MockBackend();

export const worker = setupWorker(...createHandlers(backend, { latencyMs: 300 }));
