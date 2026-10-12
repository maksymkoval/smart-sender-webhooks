import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Debounced search box. Local state keeps typing responsive; only the settled
 * value is committed (to the URL), so one search = one history entry.
 */
export function SearchInput({ value, onChange }: SearchInputProps) {
  const [draft, setDraft] = useState(value);

  // Follow external changes (back/forward navigation, reset link).
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <input
      type="search"
      className="search"
      placeholder="Search by name…"
      aria-label="Search webhooks by name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
