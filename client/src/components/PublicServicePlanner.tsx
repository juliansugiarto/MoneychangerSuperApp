import { Button } from "@/components/ui/button";
import { formatIdrDecimal } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CircleAlert, Loader2, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ActiveRate = { rate: { id: number; buyRate: string; sellRate: string; quoteUnit: string; effectiveAt: Date }; currency: { id: number; code: string; name: string } };

export function PublicServicePlanner({ rates }: { rates: ActiveRate[] }) {
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [operation, setOperation] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("100");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"PHONE" | "WHATSAPP" | "EMAIL">("PHONE");
  const [contact, setContact] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [consent, setConsent] = useState(false);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => { if (!currencyId && rates[0]) setCurrencyId(rates[0].currency.id); }, [currencyId, rates]);
  const selected = useMemo(() => rates.find((item) => item.currency.id === currencyId) ?? rates[0], [currencyId, rates]);
  const estimate = useMemo(() => {
    if (!selected) return null;
    const nominal = Number(amount); const rate = Number(operation === "BUY" ? selected.rate.buyRate : selected.rate.sellRate); const unit = Number(selected.rate.quoteUnit);
    return Number.isFinite(nominal) && nominal > 0 && Number.isFinite(rate) && unit > 0 ? (nominal * rate) / unit : null;
  }, [amount, operation, selected]);
  const createRequest = trpc.serviceRequests.create.useMutation({
    onSuccess: ({ requestNumber: number }) => { setRequestNumber(number); setFormError(null); setName(""); setContact(""); setPreferredAt(""); setConsent(false); },
    onError: (error) => setFormError(error.message || "Permintaan belum dapat dikirim. Silakan coba lagi."),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(null);
    if (!selected) return setFormError("Kurs aktif belum tersedia. Silakan hubungi outlet.");
    if (!consent) return setFormError("Persetujuan untuk dihubungi wajib diberikan.");
    const preferredServiceAt = preferredAt ? new Date(preferredAt) : undefined;
    if (preferredServiceAt && Number.isNaN(preferredServiceAt.getTime())) return setFormError("Pilih waktu kunjungan yang valid.");
    createRequest.mutate({ requesterName: name, contactChannel: channel, contactValue: contact, currencyId: selected.currency.id, operation, foreignAmount: amount, preferredServiceAt, contactConsent: true });
  };
  if (!rates.length) return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Kurs aktif sedang disiapkan. Hubungi outlet untuk informasi kurs dan ketersediaan valuta.</div>;
  return <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
    <section className="rounded-[1.5rem] border border-[#142746] bg-[#192a48] p-5 text-white shadow-[0_18px_40px_rgba(25,42,72,0.16)] sm:p-7">
      <p className="text-xs font-extrabold tracking-[0.16em] text-[#d7ec75] uppercase">Estimator kurs</p><h3 className="mt-2 font-display text-2xl">Hitung estimasi Anda</h3>
      <div className="mt-7 grid gap-4"><label className="grid gap-2 text-sm font-bold">Mata uang<select value={selected?.currency.id ?? ""} onChange={(event) => setCurrencyId(Number(event.target.value))} className="public-input">{rates.map(({ currency }) => <option key={currency.id} value={currency.id}>{currency.code} — {currency.name}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Kebutuhan<select value={operation} onChange={(event) => setOperation(event.target.value as "BUY" | "SELL")} className="public-input"><option value="BUY">Saya menjual valuta</option><option value="SELL">Saya membeli valuta</option></select></label><label className="grid gap-2 text-sm font-bold">Nominal valuta<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="public-input" /></label></div></div>
      <div className="mt-6 rounded-2xl border border-white/12 bg-[#14233e] p-5"><p className="text-xs font-bold tracking-[0.14em] text-[#cbd7ec] uppercase">Estimasi nilai Rupiah</p><p className="mt-2 font-display text-3xl text-[#d7ec75]">{estimate === null ? "Masukkan nominal" : formatIdrDecimal(estimate.toFixed(2))}</p>{selected ? <p className="mt-3 text-xs leading-5 text-[#cfdaeb]">Kurs {operation === "BUY" ? "beli" : "jual"} {selected.currency.code}, efektif {new Date(selected.rate.effectiveAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}, per unit {String(selected.rate.quoteUnit)}.</p> : null}</div>
      <p className="mt-4 flex gap-2 text-xs leading-5 text-[#cfdaeb]"><CircleAlert className="mt-0.5 size-4 shrink-0 text-[#d7ec75]" /> Estimasi bukan penguncian kurs. Harga dan ketersediaan akhir dikonfirmasi petugas outlet.</p>
    </section>
    <section className="rounded-[1.5rem] border border-[#dce2ec] bg-white p-5 shadow-[0_18px_40px_rgba(30,50,87,0.08)] sm:p-7"><p className="text-xs font-extrabold tracking-[0.16em] text-[#5d77d0] uppercase">Layanan outlet</p><h3 className="mt-2 font-display text-2xl text-[#293b58]">Minta konfirmasi kurs & ketersediaan</h3><p className="mt-3 text-sm leading-6 text-[#68778d]">Formulir ini bukan transaksi, pembayaran, atau pengumpulan data KYC.</p>{requestNumber ? <div className="mt-5 flex gap-3 rounded-2xl border border-[#b9e0b6] bg-[#eff9ee] p-4 text-sm text-[#285431]" role="status"><CheckCircle2 className="size-5 shrink-0" /><p><b>Permintaan terkirim.</b><br />Catat nomor <span className="table-number font-bold">{requestNumber}</span>. Outlet akan menghubungi Anda.</p></div> : null}
      <form className="mt-6 grid gap-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label className="public-label">Nama Anda<input required minLength={3} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="public-field" /></label><label className="public-label">Kanal dihubungi<select value={channel} onChange={(event) => setChannel(event.target.value as "PHONE" | "WHATSAPP" | "EMAIL")} className="public-field"><option value="PHONE">Telepon</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select></label></div><label className="public-label">Nomor atau email<input required minLength={6} maxLength={320} value={contact} onChange={(event) => setContact(event.target.value)} placeholder={channel === "EMAIL" ? "nama@email.com" : "+62 ..."} className="public-field" /></label><label className="public-label">Pilihan waktu kunjungan <span className="font-normal text-[#78869c]">(opsional)</span><input type="datetime-local" value={preferredAt} onChange={(event) => setPreferredAt(event.target.value)} className="public-field" /></label><label className="flex gap-3 rounded-xl bg-[#f4f7fc] p-3 text-sm leading-5 text-[#40536e]"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 accent-[#5974cc]" /><span>Saya menyetujui perusahaan menghubungi saya terkait permintaan ini dan memahami bahwa kurs akhir dikonfirmasi oleh outlet.</span></label>{formError ? <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}<Button type="submit" disabled={createRequest.isPending} className="press-scale h-12 bg-[#314b7b] font-extrabold text-white hover:bg-[#243b65]">{createRequest.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Kirim permintaan</Button></form><p className="mt-4 flex gap-2 text-xs leading-5 text-[#718097]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5872ca]" /> Jangan kirim foto identitas, nomor KTP, data rekening, atau pembayaran melalui formulir ini.</p></section>
  </div>;
}
