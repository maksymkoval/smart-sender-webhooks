export function Spinner({ label = 'Loading…', fullscreen = false }: { label?: string; fullscreen?: boolean }) {
  return (
    <div className={fullscreen ? 'spinner spinner--fullscreen' : 'spinner'} role="status" aria-live="polite">
      <span className="spinner__dot" aria-hidden="true" />
      {label}
    </div>
  );
}
