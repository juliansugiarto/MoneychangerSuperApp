import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

describe("reset kata sandi", () => {
  it("judulnya menyebut nama akun dan tombolnya menunggu kata sandi yang sah dan sama", async () => {
    render(<ResetPasswordDialog accountName="Budi Kasir" open onOpenChange={vi.fn()} isPending={false} onConfirm={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Reset kata sandi Budi Kasir?" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Kata sandi sementara"), "Sementara-2026");
    await userEvent.type(screen.getByLabelText("Ulangi kata sandi sementara"), "Sementara-2027");
    expect(screen.getByRole("button", { name: "Reset kata sandi" }).hasAttribute("disabled")).toBe(true);
  });

  it("mengirim kata sandi sementara bila keduanya sama", async () => {
    const onConfirm = vi.fn();
    render(<ResetPasswordDialog accountName="Budi Kasir" open onOpenChange={vi.fn()} isPending={false} onConfirm={onConfirm} />);
    await userEvent.type(screen.getByLabelText("Kata sandi sementara"), "Sementara-2026");
    await userEvent.type(screen.getByLabelText("Ulangi kata sandi sementara"), "Sementara-2026");
    await userEvent.click(screen.getByRole("button", { name: "Reset kata sandi" }));
    expect(onConfirm).toHaveBeenCalledWith("Sementara-2026");
  });
});
