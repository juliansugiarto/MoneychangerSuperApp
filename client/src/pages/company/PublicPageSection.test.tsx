import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicPageSection, publicPageKey } from "./PublicPageSection";

const initial = { publicPageEnabled: true, secondaryPhone: null, openingHours: null, mapUrl: null, publicFaq: null, fraudWarning: null };

describe("bagian Halaman publik", () => {
  it("mematikan halaman publik menjelaskan akibatnya", async () => {
    render(<PublicPageSection initial={initial} isPending={false} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("switch", { name: "Tampilkan halaman kurs publik" }));
    expect(screen.getByText(/langsung membuka halaman masuk staf/)).toBeTruthy();
  });

  it("tautan peta http ditolak dengan alasannya; yang https dikirim", async () => {
    const onSave = vi.fn();
    render(<PublicPageSection initial={initial} isPending={false} onSave={onSave} />);
    const map = screen.getByLabelText("Tautan peta");
    await userEvent.type(map, "http://maps.example/abc");
    expect(screen.getByText(/harus diawali https:\/\//)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan halaman publik" }).hasAttribute("disabled")).toBe(true);
    await userEvent.clear(map);
    await userEvent.type(map, "https://maps.app.goo.gl/abc");
    await userEvent.click(screen.getByRole("button", { name: "Simpan halaman publik" }));
    expect(onSave).toHaveBeenCalledWith({ publicPageEnabled: true, secondaryPhone: null, openingHours: null, mapUrl: "https://maps.app.goo.gl/abc", publicFaq: [], fraudWarning: null });
  });
});

describe("kunci pemasangan ulang bagian Halaman publik", () => {
  const saved = { ...initial, openingHours: "Senin–Sabtu 08.00–17.00", publicFaq: [{ question: "Q", answer: "A" }] };

  it("tidak berubah saat bagian lain profil disimpan, sehingga isian yang belum disimpan tidak hilang", () => {
    // Baris profil utuh membawa kolom lain; yang berubah di sini hanya palet dan `updatedAt`.
    const beforeAppearanceSave = { ...saved, themePalette: "MARUN", updatedAt: new Date("2026-09-26T09:00:00Z") };
    const afterAppearanceSave = { ...saved, themePalette: "ZAMRUD", updatedAt: new Date("2026-09-26T10:00:00Z") };
    expect(publicPageKey(afterAppearanceSave)).toBe(publicPageKey(beforeAppearanceSave));
  });

  it("berubah saat isian halaman publik yang tersimpan berubah", () => {
    expect(publicPageKey({ ...saved, openingHours: "Setiap hari" })).not.toBe(publicPageKey(saved));
  });
});
