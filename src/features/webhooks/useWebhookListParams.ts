import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * The URL is the single source of truth for list state, so reload and
 * back/forward restore it for free. Defaults (page 1, empty search) are
 * omitted from the URL to keep links canonical.
 */
export function useWebhookListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search') ?? '';

  const setPage = useCallback(
    (nextPage: number, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage > 1) next.set('page', String(nextPage));
          else next.delete('page');
          return next;
        },
        { replace: options.replace },
      );
    },
    [setSearchParams],
  );

  /** A new search always starts from the first page. */
  const setSearch = useCallback(
    (nextSearch: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const value = nextSearch.trim();
        if (value) next.set('search', value);
        else next.delete('search');
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  return { page, search, setPage, setSearch };
}
