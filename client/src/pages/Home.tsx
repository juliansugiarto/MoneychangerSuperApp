import { PublicServicePlanner } from "@/components/PublicServicePlanner";
import { formatIdrDecimal } from "@/lib/money";
import { trpc } from "@/lib/trpc";
import { latestPublicRateEffectiveAt, sortPublicRates } from "@shared/publicRates";
import { ArrowRight, BadgeCheck, CircleAlert, Clock3, FileText, Landmark, MapPin, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Link } from "wouter";

const contacts = [
  ["Telepon utama", "+62 263-265500", "tel:+62263265500"],
  ["Telepon alternatif", "+62 263-265600", "tel:+62263265600"],
];

const faqs = [
  ["Apakah kurs di halaman ini sudah terkunci?", "Belum. Kurs bersifat indikatif; petugas outlet mengonfirmasi kurs dan ketersediaan sebelum transaksi dilakukan."],
  ["Bagaimana memastikan kanal resmi?", "Gunakan nomor telepon dan alamat yang tercantum di halaman ini. Jika menerima informasi dari kanal lain, konfirmasi ulang melalui nomor resmi sebelum melanjutkan komunikasi."],
  ["Apakah formulir permintaan merupakan transaksi?", "Tidak. Formulir hanya membantu outlet memahami kebutuhan awal Anda. Formulir tidak mengunci kurs, tidak meminta KYC, dan tidak meminta pembayaran."],
  ["Apa yang perlu dibawa ke outlet?", "Siapkan kebutuhan mata uang dan nominal Anda. Petugas akan memberi arahan mengenai informasi yang diperlukan sesuai prosedur layanan."],
];

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { data: activeRates = [], isLoading: ratesLoading, isError: ratesError, refetch: refetchRates } = trpc.rates.activeRates.useQuery();
  const { data: announcements = [] } = trpc.publicContent.announcements.useQuery();
  const sortedRates = useMemo(() => sortPublicRates(activeRates), [activeRates]);
  const latestEffectiveAt = useMemo(() => latestPublicRateEffectiveAt(sortedRates), [sortedRates]);
  const updatedLabel = latestEffectiveAt ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(latestEffectiveAt) : null;
  const reveal = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 18 },
    whileInView: reduceMotion ? {} : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.14 },
    transition: { duration: 0.38, delay, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
  });

  return (
    <div className="public-shell min-h-screen overflow-x-hidden text-[#243552]">
      <section id="beranda" className="ink-panel relative overflow-hidden">
        <div className="public-grid absolute inset-0 opacity-80" />
        <div className="absolute -right-20 top-0 size-80 rounded-full bg-[#bbd66e]/18 blur-3xl" />
        <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <a href="#beranda" className="flex items-center gap-3" aria-label="Ibukota Valasindo, kembali ke beranda">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#d7ec75] font-display text-sm text-[#152541] shadow-[0_3px_0_#90a94e]">IV</span>
            <span>
              <span className="font-display block text-sm tracking-tight">Ibukota Valasindo</span>
              <span className="block text-[10px] font-bold tracking-[0.17em] text-[#cbd7ec] uppercase">Informasi Valuta</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#dfe7f5] lg:flex" aria-label="Navigasi utama">
            <a href="#kurs" className="transition-colors hover:text-[#d7ec75]">Kurs hari ini</a>
            <a href="#estimasi" className="transition-colors hover:text-[#d7ec75]">Estimasi kebutuhan</a>
            <a href="#layanan" className="transition-colors hover:text-[#d7ec75]">Layanan outlet</a>
          </nav>
          <Link href="/operasional" className="press-scale rounded-xl border border-white/18 bg-white px-4 py-2.5 text-xs font-extrabold text-[#1a2a47] transition-colors hover:bg-[#d7ec75] sm:text-sm">Area staf</Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1240px] gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10 lg:pb-20 lg:pt-16">
          <motion.div {...reveal()}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7ec75]/35 bg-white/7 px-3 py-1.5 text-xs font-bold text-[#eaf3be]"><BadgeCheck className="size-3.5" /> Kurs aktif terbuka untuk dilihat</div>
            <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.2rem]">Informasi kurs yang <span className="text-[#d7ec75]">jelas sebelum Anda datang.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#d7e1f0] sm:text-lg">Kami menampilkan seluruh kurs operasional aktif sebagai informasi indikatif. Konfirmasi harga dan ketersediaan terakhir tetap dilakukan oleh petugas outlet.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#kurs" className="press-scale inline-flex items-center gap-2 rounded-xl bg-[#d7ec75] px-5 py-3.5 text-sm font-extrabold text-[#192944] shadow-[0_4px_0_#92a752] hover:bg-[#ebf9a8]">Lihat semua kurs <ArrowRight className="size-4" /></a>
              <a href="#layanan" className="rounded-xl px-4 py-3 text-sm font-bold text-white underline decoration-[#d7ec75] underline-offset-4 hover:text-[#d7ec75]">Hubungi outlet</a>
            </div>
          </motion.div>

          <motion.aside {...reveal(0.08)} className="self-center rounded-[1.5rem] border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/15 backdrop-blur-md sm:p-6">
            <p className="text-xs font-bold tracking-[0.15em] text-[#d7ec75] uppercase">Kejelasan layanan</p>
            <h2 className="mt-2 font-display text-2xl text-white">Tiga hal yang perlu diketahui.</h2>
            <div className="mt-6 grid gap-3">
              {[
                ["01", "Seluruh kurs aktif", "Tabel kurs publik memuat semua mata uang yang sedang aktif."],
                ["02", "Kurs tetap indikatif", "Petugas memeriksa kembali kurs dan ketersediaan saat layanan."],
                ["03", "Permintaan bukan transaksi", "Tidak ada pembayaran atau data identitas yang dikumpulkan di sini."],
              ].map(([number, title, detail]) => (
                <div key={number} className="flex gap-4 rounded-2xl border border-white/10 bg-[#101f38]/35 p-4">
                  <span className="table-number flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#d7ec75] text-xs font-bold text-[#162642]">{number}</span>
                  <div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-[#cbd6e8]">{detail}</p></div>
                </div>
              ))}
            </div>
          </motion.aside>
        </div>
      </section>

      <section id="kurs" className="scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-[1120px]">
          <motion.div {...reveal()} className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl"><p className="section-kicker">Kurs operasional aktif</p><h2 className="mt-3 font-display text-3xl tracking-[-0.045em] sm:text-4xl">Seluruh kurs dalam satu tabel.</h2><p className="mt-4 text-base leading-7 text-[#5d6b82]">Tidak ada kurs yang disembunyikan oleh filter atau formulir. Gunakan tabel ini sebagai estimasi awal sebelum menghubungi outlet.</p></div>
            <div className="rounded-xl border border-[#dce2ec] bg-white px-4 py-3 text-xs text-[#66748a] shadow-sm"><span className="flex items-center gap-2 font-semibold text-[#31425f]"><Clock3 className="size-4 text-[#6680dd]" />{updatedLabel ? `Diperbarui ${updatedLabel}` : "Menunggu pembaruan kurs"}</span><p className="mt-1">Kurs bersifat indikatif.</p></div>
          </motion.div>

          <motion.div {...reveal(0.05)} className="mt-8 overflow-hidden rounded-[1.25rem] border border-[#dce2ec] bg-white shadow-[0_20px_55px_rgba(28,49,88,0.08)]">
            {ratesLoading ? <RateTableSkeleton /> : null}
            {ratesError ? <RateBoardMessage icon={CircleAlert} title="Kurs belum dapat dimuat" detail="Sambungan ke data kurs sedang terganggu. Tidak ada harga yang ditampilkan sebagai pengganti." actionLabel="Coba lagi" onAction={() => refetchRates()} /> : null}
            {!ratesLoading && !ratesError && !sortedRates.length ? <RateBoardMessage icon={Clock3} title="Belum ada kurs aktif" detail="Kurs operasional sedang disiapkan. Silakan hubungi outlet untuk memastikan kebutuhan valuta Anda." /> : null}
            {!ratesLoading && !ratesError && sortedRates.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="border-b border-[#dce2ec] bg-[#f7f9fc]"><tr className="text-[11px] font-extrabold tracking-[0.12em] text-[#68758c] uppercase"><th className="px-5 py-4">Mata uang</th><th className="px-5 py-4 text-right">Beli</th><th className="px-5 py-4 text-right">Jual</th><th className="px-5 py-4 text-right">Unit</th><th className="px-5 py-4">Efektif</th></tr></thead><tbody className="divide-y divide-[#edf0f5]">{sortedRates.map(({ currency, rate }) => <tr key={rate.id} className="interactive-lift bg-white hover:bg-[#f9fbff]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="table-number flex size-9 items-center justify-center rounded-lg bg-[#eef2ff] text-xs font-bold text-[#4c68c3]">{currency.code}</span><span><span className="block text-sm font-bold text-[#273955]">{currency.code}</span><span className="block text-xs text-[#77849a]">{currency.name}</span></span></div></td><td className="table-number px-5 py-4 text-right text-sm font-semibold text-[#263b5a]">{formatIdrDecimal(rate.buyRate)}</td><td className="table-number px-5 py-4 text-right text-sm font-semibold text-[#263b5a]">{formatIdrDecimal(rate.sellRate)}</td><td className="table-number px-5 py-4 text-right text-sm text-[#66748a]">{rate.quoteUnit}</td><td className="px-5 py-4 text-xs text-[#66748a]">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(rate.effectiveAt))}</td></tr>)}</tbody></table></div> : null}
            <div className="flex items-start gap-3 border-t border-[#dce2ec] bg-[#fbfcfe] px-5 py-4 text-xs leading-5 text-[#65738a]"><CircleAlert className="mt-0.5 size-4 shrink-0 text-[#d08e2b]" /><p><b className="text-[#394963]">Catatan transparansi.</b> Angka di atas adalah kurs operasional aktif pada waktu efektif yang tercantum. Kurs dan ketersediaan terakhir dikonfirmasi petugas sebelum transaksi dicatat.</p></div>
          </motion.div>
        </div>
      </section>

      {sortedRates.length ? <section id="estimasi" className="scroll-mt-8 border-y border-[#dce2ec] bg-[#f3f6fc] px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1120px]"><motion.div {...reveal()} className="max-w-2xl"><p className="section-kicker">Rencanakan kunjungan</p><h2 className="mt-3 font-display text-3xl tracking-[-0.045em] sm:text-4xl">Estimasi kebutuhan, lalu minta konfirmasi.</h2><p className="mt-4 text-base leading-7 text-[#5d6b82]">Pilih mata uang dari tabel kurs yang sama. Formulir ini membantu outlet menyiapkan respons; ini bukan pemesanan atau transaksi.</p></motion.div><motion.div {...reveal(0.05)} className="mt-8"><PublicServicePlanner rates={sortedRates} /></motion.div></div></section> : null}

      <section id="layanan" className="scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto grid max-w-[1120px] gap-7 lg:grid-cols-[0.88fr_1.12fr]"><motion.div {...reveal()}><p className="section-kicker">Kanal resmi</p><h2 className="mt-3 font-display text-3xl tracking-[-0.045em] sm:text-4xl">Bicara langsung dengan outlet.</h2><p className="mt-4 max-w-md text-base leading-7 text-[#5d6b82]">Konfirmasikan ketersediaan valuta, jadwal, serta layanan yang Anda perlukan melalui nomor resmi berikut.</p><div className="mt-7 grid gap-3">{contacts.map(([title, value, href]) => <a key={value} href={href} className="interactive-lift flex items-center gap-4 rounded-2xl border border-[#dce2ec] bg-white p-4 shadow-sm hover:border-[#aebdf0]"><span className="flex size-10 items-center justify-center rounded-xl bg-[#e8edff] text-[#506bd0]"><Phone className="size-5" /></span><span><span className="block text-xs font-bold tracking-wide text-[#718098] uppercase">{title}</span><span className="mt-0.5 block font-display text-lg text-[#273955]">{value}</span></span></a>)}</div></motion.div><motion.div {...reveal(0.08)} className="ink-panel rounded-[1.5rem] p-6 shadow-[0_18px_45px_rgba(22,38,66,0.2)]"><MapPin className="size-7 text-[#d7ec75]" /><p className="mt-6 text-xs font-bold tracking-[0.16em] text-[#d7ec75] uppercase">Lokasi outlet</p><h3 className="mt-2 font-display text-2xl text-white">Cianjur, Jawa Barat</h3><p className="mt-3 text-base leading-7 text-[#d8e2f2]">Jl. Mangun Sarkoro No 35, Cianjur, Jawa Barat 43214.</p><a target="_blank" rel="noreferrer" href="https://maps.google.com/?q=Jl.+Mangun+Sarkoro+No+35,+Cianjur,+Jawa+Barat+43214" className="press-scale mt-7 inline-flex items-center gap-2 rounded-xl bg-[#d7ec75] px-4 py-3 text-sm font-extrabold text-[#1a2944] hover:bg-[#ecf9aa]">Buka peta <ArrowRight className="size-4" /></a><div className="mt-7 rounded-xl border border-white/12 bg-white/[0.06] p-4 text-sm leading-6 text-[#d9e3f1]"><b className="text-[#d7ec75]">Waspada penipuan.</b> Konfirmasi ulang ke nomor resmi sebelum menindaklanjuti informasi yang mengatasnamakan perusahaan.</div></motion.div></div></section>

      {announcements.length ? <section className="border-y border-[#dce2ec] bg-white px-5 py-16 sm:px-8"><div className="mx-auto max-w-[1120px]"><p className="section-kicker">Informasi layanan</p><h2 className="mt-3 font-display text-3xl tracking-[-0.045em]">Pengumuman terkini</h2><div className="mt-7 grid gap-4 md:grid-cols-2">{announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border border-[#dce2ec] bg-[#fbfcfe] p-5"><FileText className="size-5 text-[#607be0]" /><h3 className="mt-4 font-display text-xl text-[#293a57]">{announcement.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#64738a]">{announcement.content}</p></article>)}</div></div></section> : null}

      <section id="faq" className="scroll-mt-8 bg-white px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[0.7fr_1.3fr]"><motion.div {...reveal()}><p className="section-kicker">Pertanyaan umum</p><h2 className="mt-3 font-display text-3xl tracking-[-0.045em] sm:text-4xl">Informasi yang perlu Anda tahu.</h2><p className="mt-4 text-base leading-7 text-[#5d6b82]">Kejelasan proses didahulukan sebelum transaksi. Gunakan kontak resmi jika Anda memerlukan penjelasan lebih lanjut.</p></motion.div><motion.div {...reveal(0.08)} className="grid gap-3">{faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[#dce2ec] bg-[#fcfdff] p-5 open:border-[#9eafeb]"><summary className="cursor-pointer list-none font-display text-lg text-[#2a3b59] marker:content-none">{question}<span className="float-right text-[#617de0] transition-transform duration-200 group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-6 text-[#66758c]">{answer}</p></details>)}</motion.div></div></section>

      <footer className="ink-panel px-5 py-11 sm:px-8"><div className="mx-auto flex max-w-[1120px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[#d7ec75] text-[#192944]"><Landmark className="size-5" /></span><div><p className="font-display text-sm text-white">PT IBU KOTA VALASINDO</p><p className="mt-0.5 text-xs text-[#c7d3e6]">Kurs bersifat indikatif; konfirmasi akhir dilakukan oleh outlet.</p></div></div><button onClick={() => navigate("/operasional")} className="press-scale inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#1d2d49] hover:bg-[#d7ec75]">Masuk area staf <ArrowRight className="size-4" /></button></div></footer>
    </div>
  );
}

function RateTableSkeleton() {
  return <div className="animate-pulse p-5"><div className="h-4 w-40 rounded bg-[#e8edf6]" /><div className="mt-5 space-y-3">{Array.from({ length: 5 }).map((_, index) => <div className="h-14 rounded-xl bg-[#f3f6fa]" key={index} />)}</div></div>;
}

function RateBoardMessage({ icon: Icon, title, detail, actionLabel, onAction }: { icon: typeof CircleAlert; title: string; detail: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#fff4df] text-[#c88929]"><Icon className="size-6" /></span><h3 className="mt-4 font-display text-xl text-[#2a3c59]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#69778e]">{detail}</p>{actionLabel && onAction ? <button onClick={onAction} className="press-scale mt-5 inline-flex items-center gap-2 rounded-xl border border-[#cbd5ed] bg-white px-4 py-2.5 text-sm font-bold text-[#405dbe] hover:bg-[#f1f4ff]"><RefreshCw className="size-4" />{actionLabel}</button> : null}</div>;
}
