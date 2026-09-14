import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { paletteById } from "@shared/themePalettes";
import GaleriPola from "./GaleriPola";

describe("GaleriPola", () => {
  it("memuat setiap pola dan setiap keadaan dengan data contoh statis", () => {
    const { container } = render(<GaleriPola />);
    for (const id of ["token", "palet", "kepala-halaman", "keadaan", "ubin", "tabel", "daftar-detail", "formulir", "alur", "laporan"]) {
      expect(container.querySelector(`section#${id}`), `bagian #${id}`).not.toBeNull();
    }
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("memilih baris contoh membuka panel detail, dan alur dapat maju", async () => {
    const { container } = render(<GaleriPola />);
    // Bon contoh muncul di tiga tabel galeri; klik yang berada di bagian daftar + detail.
    const bagian = container.querySelector("section#daftar-detail") as HTMLElement;
    await userEvent.click(within(bagian).getByText("FX-2026-0914-001"));
    expect(screen.getByRole("complementary", { name: "Bon FX-2026-0914-001" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(screen.getByText("Nasabah, produk, wilayah").closest("li")!.getAttribute("aria-current")).toBe("step");
  });

  it("pratinjau palet menerapkan palet terpilih hanya pada wadahnya", async () => {
    render(<GaleriPola />);
    await userEvent.click(screen.getByRole("radio", { name: "Zamrud" }));
    const wadah = screen.getByTestId("pratinjau-palet");
    expect(wadah.style.getPropertyValue("--brand")).toBe(paletteById("ZAMRUD").brand);
    expect(wadah.getAttribute("data-tema")).toBe("ZAMRUD");
    expect(document.documentElement.style.getPropertyValue("--brand")).toBe("");
  });
});
