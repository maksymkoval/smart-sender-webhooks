import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/errors';
import type { Webhook, WebhookUpdate } from '../../api/types';
import { applyServerErrors } from '../../lib/serverErrors';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { TextField } from '../../ui/TextField';
import { useUpdateWebhook, useWebhook } from './queries';

const WEBHOOK_FIELDS = ['name', 'url'] as const;

/** Back to the list the user came from (same page and search), or to the default list. */
function useListLocation(): string {
  const state = useLocation().state as { from?: { pathname: string; search: string } } | null;
  return state?.from ? `${state.from.pathname}${state.from.search}` : '/webhooks';
}

export function WebhookEditPage() {
  const id = Number(useParams().id);
  const listLocation = useListLocation();

  if (!Number.isInteger(id) || id <= 0) {
    return <NotFound backTo={listLocation} />;
  }
  return <WebhookEditLoader id={id} backTo={listLocation} />;
}

function WebhookEditLoader({ id, backTo }: { id: number; backTo: string }) {
  const { data, error, isPending, refetch } = useWebhook(id);

  if (isPending) return <Spinner label="Loading webhook…" />;
  if (error instanceof ApiError && error.isNotFound) return <NotFound backTo={backTo} />;
  if (error) {
    return (
      <section className="card">
        <ErrorState
          title="Could not load the webhook"
          message={error.message}
          action={
            <button type="button" className="button" onClick={() => void refetch()}>
              Try again
            </button>
          }
        />
      </section>
    );
  }

  // Mounted only once data exists, so defaultValues are final and a background
  // refetch never overwrites what the user is typing.
  return <WebhookForm webhook={data} backTo={backTo} />;
}

function WebhookForm({ webhook, backTo }: { webhook: Webhook; backTo: string }) {
  const navigate = useNavigate();
  const update = useUpdateWebhook(webhook.id);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebhookUpdate>({ defaultValues: { name: webhook.name, url: webhook.url } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      navigate(backTo);
    } catch (error) {
      setFormError(applyServerErrors(error, WEBHOOK_FIELDS, setError));
    }
  });

  return (
    <section className="card">
      <Link to={backTo} className="back-link">
        ← Back to webhooks
      </Link>
      <h1>Edit webhook</h1>

      {/* Validation is the server's job; the client only blocks obviously empty input. */}
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Name"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required.' })}
        />
        <TextField
          label="URL"
          type="url"
          inputMode="url"
          error={errors.url?.message}
          {...register('url', { required: 'URL is required.' })}
        />
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
          <Link to={backTo} className="button">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function NotFound({ backTo }: { backTo: string }) {
  return (
    <section className="card">
      <ErrorState
        title="Webhook not found"
        message="It may have been removed, or the link is wrong."
        action={
          <Link to={backTo} className="button">
            Back to webhooks
          </Link>
        }
      />
    </section>
  );
}
