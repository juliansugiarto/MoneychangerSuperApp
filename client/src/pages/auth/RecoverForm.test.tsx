import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoverForm } from "./RecoverForm";

async function fill(code: string, password: string, confirmation = password) {
  await userEvent.type(screen.getByLabelText("Username pemilik"), "pemilik");
  await userEvent.type(screen.getByLabelText("Kode pemulihan"), code);
  await userEvent.type(screen.getByLabelText("Kata sandi baru"), password);
  await userEvent.type(screen.getByLabelText("Ulangi kata sandi baru"), confirmation);
}

describe("formulir pulihkan akun pemilik", () => {
  it("kode berformat salah menampilkan petunjuk dan menahan tombol", async () => {
    render(<RecoverForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    await fill("abc", "Kata-sandi-baru-1");
    expect(screen.getByText(/8 huruf atau angka/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pulihkan akun" }).hasAttribute("disabled")).toBe(true);
  });

  it("kata sandi di bawah 12 karakter atau tidak sama menahan tombol", async () => {
    render(<RecoverForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    await fill("ABCD-EFGH", "pendek", "pendek");
    expect(screen.getByRole("button", { name: "Pulihkan akun" }).hasAttribute("disabled")).toBe(true);
  });

  it("kode diketik huruf kecil berspasi dikirim dalam bentuk baku", async () => {
    const onSubmit = vi.fn();
    render(<RecoverForm onSubmit={onSubmit} isPending={false} errorMessage={null} />);
    await fill("abcd efgh", "Kata-sandi-baru-1");
    await userEvent.click(screen.getByRole("button", { name: "Pulihkan akun" }));
    expect(onSubmit).toHaveBeenCalledWith({ username: "pemilik", code: "ABCD-EFGH", newPassword: "Kata-sandi-baru-1" });
  });

  it("kolom username menjelaskan bahwa yang diminta nama masuk, bukan nama peran", () => {
    render(<RecoverForm onSubmit={vi.fn()} isPending={false} errorMessage={null} />);
    const field = screen.getByLabelText("Username pemilik");
    const hint = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toContain("Nama yang Anda ketik saat masuk");
    expect(hint?.textContent).toContain("bukan nama peran");
  });
});
