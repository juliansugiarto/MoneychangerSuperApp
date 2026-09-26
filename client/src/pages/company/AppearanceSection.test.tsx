import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppearanceSection } from "./AppearanceSection";

describe("bagian Tampilan", () => {
  it("menawarkan keenam palet", () => {
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Marun" }).getAttribute("aria-checked")).toBe("true");
  });

  it("warna sendiri yang kurang kontras disebut rasionya dan tidak dapat disimpan", async () => {
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Warna utama sendiri"), "#777777");
    expect(screen.getByText(/4,48:1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan tampilan" }).hasAttribute("disabled")).toBe(true);
  });

  it("memilih palet lalu menyimpan mengirim palet itu tanpa warna sendiri", async () => {
    const onSave = vi.fn();
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole("radio", { name: "Zamrud" }));
    await userEvent.click(screen.getByRole("button", { name: "Simpan tampilan" }));
    expect(onSave).toHaveBeenCalledWith({ themePalette: "ZAMRUD", accentColor: null });
  });

  it("kode warna yang diketik tampil huruf besar, tetapi kalimat petunjuk kosongnya tetap huruf biasa", () => {
    render(<AppearanceSection initialPalette="MARUN" initialAccent={null} isPending={false} onSave={vi.fn()} />);
    const field = screen.getByLabelText("Warna utama sendiri");
    expect(field.className).toContain("uppercase");
    expect(field.className).toContain("placeholder:normal-case");
    expect(field.className).toContain("placeholder:font-sans");
  });
});
