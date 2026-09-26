import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

describe("formulir masuk", () => {
  it("menampilkan daftar cara masuk — hari ini satu, kelak SOLVINC menyusul di daftar yang sama", () => {
    render(<LoginForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    expect(screen.getByRole("list", { name: "Cara masuk" }).textContent).toContain("Username & kata sandi");
  });

  it("tombol Masuk baru aktif sesudah keduanya diisi, dan username dikirim tanpa spasi", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isPending={false} errorMessage={null} />);
    const button = screen.getByRole("button", { name: "Masuk" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Username"), "  budi.kasir ");
    await userEvent.type(screen.getByLabelText("Kata sandi"), "rahasia-sekali");
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith({ username: "budi.kasir", password: "rahasia-sekali" });
  });

  it("pesan galat dibacakan pembaca layar", () => {
    render(<LoginForm onSubmit={vi.fn()} isPending={false} errorMessage="Terlalu banyak percobaan yang gagal. Coba lagi dalam 30 detik." />);
    expect(screen.getByRole("alert").textContent).toContain("30 detik");
  });
});
