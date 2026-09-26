import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryCodeSheet, recoveryCodesText } from "./RecoveryCodeSheet";

const CODES = ["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"];

describe("lembar kode pemulihan", () => {
  it("berkas unduhan memuat nama usaha, kedelapan kode, dan peringatan sekali pakai", () => {
    const text = recoveryCodesText("ABC Valas", CODES, new Date("2026-09-26T03:00:00Z"));
    expect(text).toContain("ABC Valas");
    for (const code of CODES) expect(text).toContain(code);
    expect(text).toContain("hanya berlaku sekali");
  });

  it("tombol lanjut baru aktif sesudah pemilik mencentang sudah menyimpannya", async () => {
    const onContinue = vi.fn();
    render(<RecoveryCodeSheet brand="ABC Valas" codes={CODES} continueLabel="Masuk ke aplikasi" onContinue={onContinue} />);
    const button = screen.getByRole("button", { name: "Masuk ke aplikasi" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Saya sudah menyimpannya" }));
    await userEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
