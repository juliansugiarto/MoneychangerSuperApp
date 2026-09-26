import { OUTLINE_BUTTON } from "@/components/patterns/tebal";
import { fraudWarningOrDefault, hasContactSection, publicFaqOrDefault, telHref, type PublicFaqItem } from "@shared/publicPage";

type ContactProfile = { address?: string | null; phone?: string | null; secondaryPhone?: string | null; openingHours?: string | null; mapUrl?: string | null };

export function PublicContactSection({ profile }: { profile: ContactProfile }) {
  if (!hasContactSection(profile)) return null;
  const phones = [profile.phone, profile.secondaryPhone].map((phone) => phone?.trim()).filter(Boolean) as string[];
  return (
    <section aria-labelledby="kontak" className="rounded-[0.75rem] border-2 border-ink bg-surface-raised p-4 shadow-tile">
      <h2 id="kontak" className="font-heading text-body font-extrabold text-ink">Hubungi dan kunjungi kami</h2>
      <dl className="mt-2 grid gap-2 text-body sm:grid-cols-[9rem_1fr]">
        {profile.address?.trim() ? <><dt className="text-ink-muted">Alamat</dt><dd className="whitespace-pre-line text-ink">{profile.address}</dd></> : null}
        {phones.length ? <><dt className="text-ink-muted">Telepon</dt><dd className="flex flex-wrap gap-x-3">{phones.map((phone) => <a key={phone} href={telHref(phone)} className="font-semibold text-ink underline underline-offset-4">{phone}</a>)}</dd></> : null}
        {profile.openingHours?.trim() ? <><dt className="text-ink-muted">Jam buka</dt><dd className="text-ink">{profile.openingHours}</dd></> : null}
      </dl>
      {profile.mapUrl ? <a href={profile.mapUrl} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center ${OUTLINE_BUTTON}`}>Buka peta</a> : null}
    </section>
  );
}

export function FraudNotice({ text }: { text: string | null | undefined }) {
  return <p role="note" className="rounded-lg border-2 border-ink bg-warning-soft px-3 py-2 text-body font-semibold text-ink">{fraudWarningOrDefault(text)}</p>;
}

export function PublicFaqSection({ faq }: { faq: readonly PublicFaqItem[] | null | undefined }) {
  return (
    <section aria-labelledby="faq">
      <h2 id="faq" className="font-heading text-body font-extrabold text-ink">Pertanyaan umum</h2>
      <div className="mt-2 grid gap-2">
        {publicFaqOrDefault(faq).map((item) => (
          <details key={item.question} className="rounded-lg border-[1.5px] border-line bg-surface-raised px-3 py-2">
            <summary className="cursor-pointer text-body font-semibold text-ink">{item.question}</summary>
            <p className="mt-1 text-body text-ink-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function AnnouncementsSection({ items }: { items: { id: number; title: string; content: string }[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="pengumuman">
      <h2 id="pengumuman" className="font-heading text-body font-extrabold text-ink">Pengumuman</h2>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border-[1.5px] border-line bg-surface-raised p-3">
            <h3 className="text-body font-bold text-ink">{item.title}</h3>
            <p className="mt-1 whitespace-pre-line text-body text-ink-muted">{item.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
