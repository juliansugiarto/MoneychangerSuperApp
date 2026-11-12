import { useEffect, useMemo, useState } from "react";
import { AMOUNT_ERRORS, estimateTotal, fmt, parseAmount, type Dir, type RateView } from "./viewModel";

export type Calculation = {
  view: RateView;
  amount: string;
  amountText: string;
  total: number;
  rate: number;
};

type Snapshot = { viewId: string; jual: number; beli: number };

/**
 * Keadaan kalkulator §2 yang juga dibaca tiket §3. Kurs yang dipakai dibekukan saat menghitung; bila kurs aktif
 * berubah sesudahnya, `rateChanged` menyalakan kotak "Kurs sudah berubah" (rujukan `#chgBox`) sampai dihitung ulang.
 */
export function useCalculation(views: RateView[], dir: Dir) {
  const [code, setCode] = useState("");
  const [viewId, setViewId] = useState("");
  const [amountRaw, setAmountRaw] = useState("500");
  const [strict, setStrict] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const codes = useMemo(() => [...new Map(views.map((view) => [view.code, view.name])).entries()], [views]);
  const denominations = useMemo(() => views.filter((view) => view.code === code), [views, code]);
  const current = views.find((view) => view.id === viewId) ?? null;

  // Pilihan awal mengikuti rujukan: USD bila ada, pecahan pertamanya.
  useEffect(() => {
    if (code || !views.length) return;
    const first = views.find((view) => view.code === "USD") ?? views[0];
    setCode(first.code);
    setViewId(first.id);
    setSnapshot({ viewId: first.id, jual: first.jual, beli: first.beli });
  }, [views, code]);

  const freeze = (next: RateView | null) => setSnapshot(next ? { viewId: next.id, jual: next.jual, beli: next.beli } : null);

  const chooseCode = (next: string) => {
    setCode(next);
    const list = views.filter((view) => view.code === next);
    const only = list.length === 1 ? list[0] : null;
    setViewId(only?.id ?? "");
    freeze(only);
  };
  const chooseView = (next: string) => { setViewId(next); freeze(views.find((view) => view.id === next) ?? null); };
  const changeAmount = (next: string) => { setAmountRaw(next); freeze(current); };
  const recalculate = () => freeze(current);

  const parsed = parseAmount(amountRaw);
  const errors = {
    cur: !code ? AMOUNT_ERRORS.cur : "",
    den: code && !current ? AMOUNT_ERRORS.den : "",
    amt: "error" in parsed && (parsed.error !== "empty" || strict) ? AMOUNT_ERRORS[parsed.error] : "",
  };

  let result: Calculation | null = null;
  if (current && snapshot?.viewId === current.id && "value" in parsed) {
    const frozen = { ...current, jual: snapshot.jual, beli: snapshot.beli };
    result = { view: frozen, amount: parsed.value, amountText: fmt(Number(parsed.value)), total: estimateTotal(frozen, dir, parsed.value), rate: frozen[dir] };
  }
  const rateChanged = Boolean(current && snapshot?.viewId === current.id && (current.jual !== snapshot.jual || current.beli !== snapshot.beli));
  // Kurs pilihan hilang dari papan (dinonaktifkan staf) = tidak bisa diminta konfirmasinya.
  const selectionGone = Boolean(viewId) && !current;

  return { code, viewId, amountRaw, codes, denominations, errors, result, rateChanged, selectionGone, chooseCode, chooseView, changeAmount, recalculate, submitStrict: () => setStrict(true) };
}

export type CalculationState = ReturnType<typeof useCalculation>;
