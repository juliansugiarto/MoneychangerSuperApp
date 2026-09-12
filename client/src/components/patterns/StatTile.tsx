export function StatTile({ label, value, hint, onOpen }: { label: string; value: string; hint?: string; onOpen?: () => void }) {
  const body = (
    <>
      <p className="text-label text-ink-muted">{label}</p>
      <p className="mt-1 text-title font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-label text-ink-subtle">{hint}</p> : null}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="rounded-lg border border-line bg-surface-raised p-4 text-left hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand">
      {body}
    </button>
  ) : (
    <div className="rounded-lg border border-line bg-surface-raised p-4">{body}</div>
  );
}
