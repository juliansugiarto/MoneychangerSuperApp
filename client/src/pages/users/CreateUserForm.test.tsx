import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateUserForm } from "./CreateUserForm";

describe("buat akun", () => {
  it("peran Controller hanya ditawarkan kepada Pemegang Saham", () => {
    const { rerender } = render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("option", { name: "Controller" })).toBeNull();
    rerender(<CreateUserForm isShareholder isPending={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Controller" })).toBeTruthy();
  });

  it("kata sandi awal di bawah 12 karakter menahan tombol; yang sah dikirim dengan username baku", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Nama"), "Budi Kasir");
    await userEvent.type(screen.getByLabelText("Username"), " Budi.Kasir ");
    await userEvent.type(screen.getByLabelText("Kata sandi awal"), "pendek");
    const button = screen.getByRole("button", { name: "Buat akun" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kata sandi awal"), "-cukup-panjang");
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith({ name: "Budi Kasir", username: "budi.kasir", password: "pendek-cukup-panjang", role: "STAFF" });
  });

  async function fillValid() {
    await userEvent.type(screen.getByLabelText("Nama"), "Budi Kasir");
    await userEvent.type(screen.getByLabelText("Username"), "budi.kasir");
    await userEvent.type(screen.getByLabelText("Kata sandi awal"), "cukup-panjang-2026");
    await userEvent.click(screen.getByRole("button", { name: "Buat akun" }));
  }

  it("isian dikosongkan hanya sesudah server membuat akunnya", async () => {
    render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    await fillValid();
    await waitFor(() => expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe(""));
  });

  it("username yang sudah terpakai ditolak server tanpa membuang isian yang sudah diketik", async () => {
    render(<CreateUserForm isShareholder={false} isPending={false} onSubmit={vi.fn().mockRejectedValue(new Error("Username sudah dipakai."))} />);
    await fillValid();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("budi.kasir");
    expect((screen.getByLabelText("Nama") as HTMLInputElement).value).toBe("Budi Kasir");
  });
});
