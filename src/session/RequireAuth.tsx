import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom';
import { Spinner } from '../ui/Spinner';
import { useSession } from './SessionProvider';

export interface LoginRedirectState {
  /** Where to return after sign-in — keeps list page/search across re-login. */
  from?: Pick<Location, 'pathname' | 'search'>;
}

export function RequireAuth() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status === 'checking') return <Spinner label="Checking session…" fullscreen />;

  if (state.status === 'anonymous') {
    const redirectState: LoginRedirectState = state.signedOut
      ? {}
      : { from: { pathname: location.pathname, search: location.search } };
    return <Navigate to="/login" replace state={redirectState} />;
  }

  return <Outlet />;
}
