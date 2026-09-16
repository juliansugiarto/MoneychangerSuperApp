import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RateBoardFooter } from "./RateBoardFooter";

describe("bilah aktivasi", () => {
  it("menyebut jumlah kurs yang siap diaktifkan", () => {
    render(<RateBoardFooter pendingCount={26} reason="" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={vi.fn()} isPending={false} />);
    expect(screen.getByRole("button", { name: "Aktifkan 26 kurs" })).toBeTruthy();
  });

  it("menonaktifkan tombol sampai alasannya mencapai sepuluh karakter", async () => {
    const onActivate = vi.fn();
    const { rerender } = render(<RateBoardFooter pendingCount={3} reason="naik" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={onActivate} isPending={false} />);
    expect(screen.getByRole("button", { name: "Aktifkan 3 kurs" }).hasAttribute("disabled")).toBe(true);
    rerender(<RateBoardFooter pendingCount={3} reason="Kurs pagi mengikuti referensi BI." onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={onActivate} isPending={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Aktifkan 3 kurs" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("tidak muncul sama sekali ketika belum ada yang berubah", () => {
    const { container } = render(<RateBoardFooter pendingCount={0} reason="" onReasonChange={vi.fn()} onDiscard={vi.fn()} onActivate={vi.fn()} isPending={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("membuang draf lewat tombolnya sendiri", async () => {
    const onDiscard = vi.fn();
    render(<RateBoardFooter pendingCount={2} reason="" onReasonChange={vi.fn()} onDiscard={onDiscard} onActivate={vi.fn()} isPending={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Buang draf" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
