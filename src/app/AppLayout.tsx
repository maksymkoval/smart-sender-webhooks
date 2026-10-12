import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useCurrentUser, useSession } from '../session/SessionProvider';

export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // RequireAuth redirects to /login once the session is gone.
    await logout();
  };

  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/webhooks" className="topbar__brand">
          Smart Sender
        </Link>
        <div className="topbar__user">
          <span title={user.email}>{user.name}</span>
          <button type="button" className="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}
