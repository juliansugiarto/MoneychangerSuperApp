import { FOCUS_RING } from "./tebal";

const TONES = {
  plain: "bg-surface-raised text-ink",
  brand: "bg-brand text-brand-contrast",
  second: "bg-second text-second-contrast",
} as const;

/** Ubin angka Konter Tebal: blok bergaris tinta dengan bayangan keras. `tone` memilih blok utama, kedua, atau polos. */
export function StatTile({ label, value, hint, onOpen, tone = "plain" }: {
  label: string;
  value: string;
  hint?: string;
  onOpen?: () => void;
  tone?: keyof typeof TONES;
}) {
  const body = (
    <>
      <p className="text-label font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-label font-semibold opacity-80">{hint}</p> : null}
    </>
  );
  const frame = `rounded-[0.75rem] border-2 border-ink p-3 shadow-tile ${TONES[tone]}`;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${frame} text-left transition-transform hover:-translate-x-px hover:-translate-y-px motion-reduce:transition-none ${FOCUS_RING}`}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
