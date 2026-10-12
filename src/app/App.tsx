import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { WebhookEditPage } from '../features/webhooks/WebhookEditPage';
import { WebhooksPage } from '../features/webhooks/WebhooksPage';
import { RequireAuth } from '../session/RequireAuth';
import { SessionProvider } from '../session/SessionProvider';
import { AppLayout } from './AppLayout';
import { queryClient } from './queryClient';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/webhooks" element={<WebhooksPage />} />
                <Route path="/webhooks/:id/edit" element={<WebhookEditPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/webhooks" replace />} />
          </Routes>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
