import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicRateTable } from "./PublicRateTable";

describe("tabel kurs publik", () => {
  it("baris tingkat valuta berlabel Pecahan lain dengan harga berformat Rupiah", () => {
    render(<PublicRateTable isLoading={false} isError={false} onRetry={vi.fn()} rates={[{ rate: { id: 1, buyRate: "16200.000000", sellRate: "16290.000000", quoteUnit: "1", effectiveAt: new Date("2026-09-26T01:00:00Z") }, currency: { id: 1, code: "USD", name: "Dolar Amerika" }, tier: null }]} />);
    const row = screen.getByRole("row", { name: /USD/ });
    expect(row.textContent).toContain("Pecahan lain");
    expect(row.textContent).toContain("Rp 16,290");
  });
});
