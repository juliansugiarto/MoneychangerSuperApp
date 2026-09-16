import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RateBoardGrid } from "./RateBoardGrid";
import type { BoardCellPayload } from "@shared/rateBoard";

const cell = (over: Partial<BoardCellPayload> = {}): BoardCellPayload => ({
  currencyId: 1, currencyCode: "USD", currencyName: "Dolar Amerika Serikat", rateTierId: 5, tierLabel: "100", sortOrder: 1,
  quoteUnit: "1.000000", activeRateId: 21, activeBuyRate: "16290.000000", activeSellRate: "16400.000000", activeEffectiveAt: new Date("2026-09-16T02:00:00Z"),
  draftRateId: null, draftBuyRate: null, draftSellRate: null,
  referenceBuyRate: "16200.000000", referenceSellRate: "16360.000000", referenceSnapshotId: 9, ...over,
});
const CELLS = [cell(), cell({ rateTierId: 6, tierLabel: "5–20", sortOrder: 2, activeBuyRate: "16100.000000", activeSellRate: "16250.000000" })];

describe("kisi papan kurs", () => {
  it("menampilkan satu baris per kelompok dengan kolom yang disepakati", () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    for (const header of ["Valuta", "Kelompok", "Referensi BI", "Beli", "Jual", "Selisih", "Status"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
    }
    expect(screen.getByText("5–20")).toBeTruthy();
  });

  it("menyorot baris dan kolom sel yang sedang difokus", async () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Kurs beli USD 100");
    await userEvent.click(input);
    expect(input.closest("tr")?.getAttribute("data-sorot")).toBe("baris");
    expect(input.closest("td")?.getAttribute("data-sorot")).toBe("sel");
  });

  it("menandai sel yang berubah dan menampilkan nilai lamanya dicoret", () => {
    render(<RateBoardGrid cells={CELLS} edits={{ "1:5": { buyRate: "16350" } }} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const input = screen.getByLabelText("Kurs beli USD 100");
    expect(input.closest("td")?.getAttribute("data-berubah")).toBe("ya");
    // Nilai lama memakai format id-ID yang sama dengan seluruh kisi.
    expect(screen.getByText("16.290", { selector: "del, del *" })).toBeTruthy();
  });

  it("↓ memindahkan fokus ke sel kolom yang sama pada baris berikutnya", async () => {
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={vi.fn()} onCommit={vi.fn()} />);
    const atas = screen.getByLabelText("Kurs beli USD 100");
    atas.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByLabelText("Kurs beli USD 5–20"));
  });

  it("Enter menyimpan draf sel yang sedang disunting", async () => {
    const onCommit = vi.fn();
    render(<RateBoardGrid cells={CELLS} edits={{ "1:5": { buyRate: "16350" } }} onEdit={vi.fn()} onCommit={onCommit} />);
    screen.getByLabelText("Kurs beli USD 100").focus();
    await userEvent.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("meneruskan setiap ketikan ke onEdit dengan kunci selnya", async () => {
    const onEdit = vi.fn();
    render(<RateBoardGrid cells={CELLS} edits={{}} onEdit={onEdit} onCommit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Kurs jual USD 100"), "7");
    expect(onEdit).toHaveBeenCalledWith("1:5", "sellRate", expect.stringContaining("7"));
  });
});
