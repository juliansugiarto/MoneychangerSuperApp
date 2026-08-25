export type RegulatoryActionItem = { id: number; packageNumber: string; status: string; reportType: string; createdAt: Date | string; manualDueAt?: Date | string | null };

export function getRegulatoryActionQueue(items: RegulatoryActionItem[], now = new Date()) {
  const draft = items.filter((item) => item.status === "DRAFT");
  const prepared = items.filter((item) => item.status === "PREPARED");
  const returned = items.filter((item) => item.status === "RETURNED");
  const actionable = [...draft, ...prepared, ...returned];
  const overdue = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() < now.getTime());
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const dueToday = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() >= now.getTime() && new Date(item.manualDueAt).getTime() <= endOfToday.getTime());
  const upcoming = actionable.filter((item) => item.manualDueAt && new Date(item.manualDueAt).getTime() > endOfToday.getTime());
  return { draft, prepared, returned, overdue, dueToday, upcoming, total: actionable.length, hasActions: actionable.length > 0 };
}

export function getRegulatoryReportingReadiness(items: RegulatoryActionItem[], unavailable = false, now = new Date()) {
  const queue = getRegulatoryActionQueue(items, now);
  if (unavailable) return { ready: false, unavailable: true, queue, detail: "Status paket belum tersedia. Buka Pelaporan Regulator untuk pemeriksaan." };
  if (!queue.hasActions) return { ready: true, unavailable: false, queue, detail: "Tidak ada draf atau paket yang menunggu pemeriksaan." };
  const parts = [`${queue.draft.length} draf`, `${queue.prepared.length} paket siap diperiksa`, `${queue.returned.length} paket dikembalikan`];
  const overdue = queue.overdue.length ? ` ${queue.overdue.length} melewati tenggat manual.` : "";
  return { ready: false, unavailable: false, queue, detail: `${parts.join(", ")}.${overdue}` };
}
