import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryCodeNotice } from "./RecoveryCodeNotice";

describe("ajakan kode pemulihan", () => {
  it("tidak tampil untuk peran lain, sisa yang cukup, atau data yang belum dimuat", () => {
    const { container, rerender } = render(<RecoveryCodeNotice role="CONTROLLER" remaining={0} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<RecoveryCodeNotice role="SHAREHOLDER" remaining={3} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<RecoveryCodeNotice role="SHAREHOLDER" remaining={null} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("pemilik tanpa kode — pemilik produksi hari ini — diajak membuatnya", async () => {
    const onOpen = vi.fn();
    render(<RecoveryCodeNotice role="SHAREHOLDER" remaining={0} onOpen={onOpen} />);
    expect(screen.getByRole("status").textContent).toContain("belum punya kode pemulihan");
    await userEvent.click(screen.getByRole("button", { name: "Buat kode pemulihan" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sisa satu atau dua kode menyebut jumlahnya", () => {
    render(<RecoveryCodeNotice role="SHAREHOLDER" remaining={2} onOpen={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Tinggal 2 kode pemulihan");
  });
});
