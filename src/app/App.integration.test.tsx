// @vitest-environment jsdom
/**
 * End-to-end walk through the real <App> against the same MSW handlers the
 * browser uses: login, URL state, editing with server errors, session expiry,
 * lost session and logout.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MockBackend } from '../mocks/backend';
import { createHandlers } from '../mocks/handlers';
import { TEST_CREDENTIALS } from '../mocks/seed';

const backend = new MockBackend();
const server = setupServer(...createHandlers(backend, { latencyMs: 10 }));

let log: string[] = [];
server.events.on('response:mocked', ({ request, response }) => {
  log.push(`${request.method} ${new URL(request.url).pathname} ${response.status}`);
});
const takeLog = () => log.splice(0);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => {
  cleanup();
  server.close();
});

const currentUrl = () => `${window.location.pathname}${window.location.search}`;
const tableRows = () => screen.getAllByRole('row').slice(1);

it('covers the main user flow', async () => {
  // Deep link into a list state before signing in.
  window.history.replaceState(null, '', '/webhooks?page=2&search=order');
  const { App } = await import('./App');
  const user = userEvent.setup();
  render(<App />);

  async function signIn(password: string) {
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), TEST_CREDENTIALS.email);
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  // No session on boot: CSRF first, then /me → 401 → rotate 400 → login screen.
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(takeLog()).toEqual(['GET /csrf 204', 'GET /v1/me 401', 'POST /auth/token/rotate 400']);
  expect(localStorage.getItem('device_fingerprint')).toMatch(/^[0-9a-f]{32}$/);

  // Wrong password → error next to the field.
  await signIn('wrong-password');
  expect(await screen.findByText('These credentials do not match our records.')).toBeTruthy();

  // Success → back to the deep link; page 2 doesn't exist for "order" (8 results) → page 1.
  await signIn(TEST_CREDENTIALS.password);
  await screen.findByRole('heading', { name: 'Webhooks' });
  await waitFor(() => expect(currentUrl()).toBe('/webhooks?search=order'));
  await waitFor(() => expect(tableRows()).toHaveLength(8));

  // New search resets the page and lands in the URL.
  const search = screen.getByRole('searchbox');
  await user.clear(search);
  await user.type(search, 'chat');
  await waitFor(() => expect(currentUrl()).toBe('/webhooks?search=chat'));
  await waitFor(() => expect(tableRows()).toHaveLength(4));

  // Empty state.
  await user.type(search, 'zzz');
  expect(await screen.findByText(/No webhooks match/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  await waitFor(() => expect(currentUrl()).toBe('/webhooks'));

  // Pagination is restored by back/forward.
  await user.click(await screen.findByRole('button', { name: /Next/ }));
  await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeTruthy());
  expect(currentUrl()).toBe('/webhooks?page=2');
  window.history.back();
  await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeTruthy());
  window.history.forward();
  await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeTruthy());

  // Edit: server validation error shown on the field, then save returns to page 2.
  await user.click(within(tableRows()[0]!).getByRole('link', { name: 'Edit' }));
  const urlInput = await screen.findByLabelText('URL');
  await user.clear(urlInput);
  await user.type(urlInput, 'ftp://not-http');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('The url must be a valid URL.')).toBeTruthy();

  await user.clear(screen.getByLabelText('Name'));
  await user.type(screen.getByLabelText('Name'), 'Renamed hook');
  await user.clear(urlInput);
  await user.type(urlInput, 'https://ok.example.com/hook');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(currentUrl()).toBe('/webhooks?page=2'));
  expect(await screen.findByText('Renamed hook')).toBeTruthy();

  // Expired session is refreshed transparently.
  takeLog();
  backend.expireSession();
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await waitFor(() => expect(screen.getByText('Page 3 of 3')).toBeTruthy());
  expect(takeLog()).toEqual(['GET /v1/webhooks 401', 'POST /auth/token/rotate 200', 'GET /v1/webhooks 200']);

  // Server lost the session → login, then back to where the user was.
  backend.revoke();
  await user.type(screen.getByRole('searchbox'), 'lead');
  await screen.findByRole('heading', { name: 'Sign in' });
  await signIn(TEST_CREDENTIALS.password);
  await waitFor(() => expect(currentUrl()).toBe('/webhooks?search=lead'));
  await waitFor(() => expect(tableRows()).toHaveLength(2));

  // Sign out → revoke and a plain login screen.
  takeLog();
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(currentUrl()).toBe('/login');
  expect(takeLog()).toEqual(['POST /auth/token/revoke 204']);
}, 30_000);
