import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Paging, Webhook } from '../../api/types';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { useWebhookList } from './queries';
import { SearchInput } from './SearchInput';
import { useWebhookListParams } from './useWebhookListParams';

export function WebhooksPage() {
  const { page, search, setPage, setSearch } = useWebhookListParams();
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useWebhookList({ page, search });

  // A stale link (e.g. ?page=9 after a narrower search) → jump to the last real page.
  const lastPage = data?.paging.pages.last;
  useEffect(() => {
    if (!isPlaceholderData && lastPage !== undefined && page > lastPage) setPage(lastPage, { replace: true });
  }, [isPlaceholderData, lastPage, page, setPage]);

  return (
    <section className="card">
      <header className="toolbar">
        <h1>Webhooks</h1>
        <SearchInput value={search} onChange={setSearch} />
      </header>

      {isPending ? (
        <Spinner label="Loading webhooks…" />
      ) : error ? (
        <ErrorState
          title="Could not load webhooks"
          message={error.message}
          action={
            <button type="button" className="button" onClick={() => void refetch()}>
              Try again
            </button>
          }
        />
      ) : data.data.length === 0 ? (
        <div className="state">
          <strong>{search ? `No webhooks match “${search}”` : 'No webhooks yet'}</strong>
          {search && (
            <button type="button" className="button" onClick={() => setSearch('')}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <WebhookTable webhooks={data.data} dimmed={isFetching && isPlaceholderData} />
          <Pagination paging={data.paging} onChange={setPage} disabled={isPlaceholderData} />
        </>
      )}
    </section>
  );
}

function WebhookTable({ webhooks, dimmed }: { webhooks: Webhook[]; dimmed: boolean }) {
  const location = useLocation();

  return (
    <div className="table-wrap" aria-busy={dimmed}>
      <table className={dimmed ? 'table table--dimmed' : 'table'}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">URL</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => (
            <tr key={webhook.id}>
              <td>{webhook.name}</td>
              <td className="table__url">{webhook.url}</td>
              <td>
                <span className={webhook.active ? 'badge badge--on' : 'badge'}>
                  {webhook.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="table__actions">
                {/* Pass the list location so "Back" returns to the same page and search. */}
                <Link to={`/webhooks/${webhook.id}/edit`} state={{ from: location }}>
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  paging: Paging;
  onChange: (page: number) => void;
  disabled: boolean;
}

function Pagination({ paging, onChange, disabled }: PaginationProps) {
  const { current, last } = paging.pages;
  const { total, limitation } = paging.results;
  const from = (current - 1) * limitation + 1;
  const to = Math.min(current * limitation, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="pagination__buttons">
        <button type="button" className="button" disabled={disabled || current <= 1} onClick={() => onChange(current - 1)}>
          ← Prev
        </button>
        <span aria-current="page">
          Page {current} of {last}
        </span>
        <button type="button" className="button" disabled={disabled || current >= last} onClick={() => onChange(current + 1)}>
          Next →
        </button>
      </div>
    </nav>
  );
}
