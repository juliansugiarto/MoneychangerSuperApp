import type { OpeningStatusText } from "@shared/openingStatus";

const toneToState = { open: "open", soon: "soon", closed: "closed", unknown: "unknown" } as const;

/** Chip Buka / Segera tutup / Tutup + penjelasnya; sama persis di kepala, §1, dan §5 (spec teks). */
export const StatusChip = ({ status }: { status: OpeningStatusText }) => <span className="chip" data-s={toneToState[status.tone]}>{status.chip}</span>;

export const StatusLine = ({ status, style }: { status: OpeningStatusText; style?: React.CSSProperties }) => (
  <div className="status-line" style={style}><StatusChip status={status} /><span>{status.detail}</span></div>
);
