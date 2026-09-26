import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicPageSection } from "./PublicPageSection";

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
