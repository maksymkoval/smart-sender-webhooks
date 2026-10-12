import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionExpired } from '../api/client';
import type { LoginCredentials, User } from '../api/types';

type SessionState =
  | { status: 'checking' }
  /** `signedOut`: the user left on purpose, so there is nothing to return to after login. */
  | { status: 'anonymous'; signedOut?: boolean }
  | { status: 'authenticated'; user: User };

interface SessionContextValue {
  state: SessionState;
  login(credentials: LoginCredentials): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'checking' });

  const endLocalSession = useCallback(
    (signedOut = false) => {
      queryClient.clear();
      setState({ status: 'anonymous', signedOut });
    },
    [queryClient],
  );

  // Unrecoverable 401 anywhere in the app → back to the login screen.
  useEffect(() => onSessionExpired(() => endLocalSession()), [endLocalSession]);

  // The server session is invisible to us (HttpOnly-cookie semantics), so the
  // only way to know whether one exists is to ask. With the in-memory mock a
  // reload always lands on login, but a real backend would resume here.
  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((user) => !cancelled && setState({ status: 'authenticated', user }))
      .catch(() => !cancelled && setState({ status: 'anonymous' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      // The device token lives only in this scope: never in state, storage or URL.
      const { device_session_token } = await api.auth.login(credentials);
      await api.auth.issue(device_session_token);
      const user = await api.auth.me();
      queryClient.clear();
      setState({ status: 'authenticated', user });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.revoke();
    } finally {
      // Even if revoke fails, the user asked to leave — drop local data.
      endLocalSession(true);
    }
  }, [endLocalSession]);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** For screens that only render behind <RequireAuth>. */
export function useCurrentUser(): User {
  const { state } = useSession();
  if (state.status !== 'authenticated') throw new Error('useCurrentUser requires an authenticated session');
  return state.user;
}
