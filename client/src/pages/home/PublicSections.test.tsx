import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_FRAUD_WARNING, DEFAULT_PUBLIC_FAQ } from "@shared/publicPage";
import { FraudNotice, PublicContactSection, PublicFaqSection } from "./PublicSections";

describe("bagian halaman publik", () => {
  it("bagian kontak tidak dirender sama sekali bila kosong", () => {
    const { container } = render(<PublicContactSection profile={{ address: null, phone: " ", secondaryPhone: null, openingHours: null, mapUrl: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("nomor telepon menjadi tautan panggilan", () => {
    render(<PublicContactSection profile={{ address: null, phone: "+62 263-265500", secondaryPhone: null, openingHours: null, mapUrl: null }} />);
    expect(screen.getByRole("link", { name: "+62 263-265500" }).getAttribute("href")).toBe("tel:+62263265500");
  });

  it("FAQ kosong memakai pertanyaan umum bawaan", () => {
    render(<PublicFaqSection faq={null} />);
    expect(screen.getByText(DEFAULT_PUBLIC_FAQ[0].question)).toBeTruthy();
  });

  it("peringatan penipuan kosong memakai kalimat bawaan", () => {
    render(<FraudNotice text={null} />);
    expect(screen.getByText(DEFAULT_FRAUD_WARNING)).toBeTruthy();
  });
});
