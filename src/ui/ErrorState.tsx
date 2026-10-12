import type { ReactNode } from 'react';

interface ErrorStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
