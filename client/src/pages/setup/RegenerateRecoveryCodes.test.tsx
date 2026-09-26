import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegenerateRecoveryCodes } from "./RegenerateRecoveryCodes";

describe("buat ulang kode pemulihan", () => {
  it("meminta kata sandi saat ini dan memperingatkan bahwa kode lama batal", async () => {
    const onRegenerate = vi.fn();
    render(<RegenerateRecoveryCodes brand="ABC Valas" codes={null} errorMessage={null} isPending={false} onRegenerate={onRegenerate} onDone={vi.fn()} />);
    expect(screen.getByText(/seluruh kode lama yang belum terpakai batal/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Buat 8 kode baru" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kata sandi saat ini"), "Pemilik-abc-2026");
    await userEvent.click(button);
    expect(onRegenerate).toHaveBeenCalledWith("Pemilik-abc-2026");
  });

  it("sesudah berhasil menampilkan lembar kode, bukan formulir lagi", () => {
    render(<RegenerateRecoveryCodes brand="ABC Valas" codes={["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"]} errorMessage={null} isPending={false} onRegenerate={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText("NP67-QR89")).toBeTruthy();
    expect(screen.queryByLabelText("Kata sandi saat ini")).toBeNull();
  });
});
