import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';
import type { LoginCredentials } from '../../api/types';
import { applyServerErrors } from '../../lib/serverErrors';
import type { LoginRedirectState } from '../../session/RequireAuth';
import { useSession } from '../../session/SessionProvider';
import { TextField } from '../../ui/TextField';

const LOGIN_FIELDS = ['email', 'password'] as const;
const DEFAULT_REDIRECT = '/webhooks';

function redirectTarget(state: unknown): string {
  const from = (state as LoginRedirectState | null)?.from;
  return from ? `${from.pathname}${from.search}` : DEFAULT_REDIRECT;
}

export function LoginPage() {
  const { state, login } = useSession();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({ defaultValues: { email: '', password: '' } });

  if (state.status === 'authenticated') return <Navigate to={redirectTarget(location.state)} replace />;

  const onSubmit = handleSubmit(async (credentials) => {
    setFormError(null);
    try {
      // On success the session becomes "authenticated" and the <Navigate> above redirects.
      await login(credentials);
    } catch (error) {
      setFormError(applyServerErrors(error, LOGIN_FIELDS, setError));
    }
  });

  return (
    <main className="auth">
      <form className="card auth__card" onSubmit={onSubmit} noValidate>
        <h1>Sign in</h1>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
          error={errors.email?.message}
          {...register('email', { required: 'Enter your email.' })}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Enter your password.' })}
        />
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
