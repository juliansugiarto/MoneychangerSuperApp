import { render, screen } from "@testing-library/react";
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
    const onSubmit = vi.fn();
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
});
