import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

const next = () => screen.getByRole("button", { name: "Lanjut" });

function renderWizard(onComplete = vi.fn().mockResolvedValue({ recoveryCodes: ["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ", "2345-6789", "AB23-CD45", "EF67-GH89", "JK23-LM45", "NP67-QR89"] })) {
  render(<SetupWizard onComplete={onComplete} errorMessage={null} isPending={false} brand="Aplikasi Valuta" onFinish={vi.fn()} />);
  return onComplete;
}

async function passCodeAndOwner(password = "Pemilik-abc-2026", confirmation = password) {
  await userEvent.type(screen.getByLabelText("Kode penyiapan"), "abcd efgh jklm");
  await userEvent.click(next());
  await userEvent.type(screen.getByLabelText("Nama Anda"), "Pemilik ABC");
  await userEvent.type(screen.getByLabelText("Username"), " Pemilik.ABC ");
  await userEvent.type(screen.getByLabelText("Kata sandi"), password);
  await userEvent.type(screen.getByLabelText("Ulangi kata sandi"), confirmation);
}

describe("wizard penyiapan", () => {
  it("langkah kode baru dapat dilewati sesudah kode berformat benar diketik", async () => {
    renderWizard();
    expect(next().hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kode penyiapan"), "abcd");
    expect(next().hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Kode penyiapan"), "-efgh-jklm");
    expect(next().hasAttribute("disabled")).toBe(false);
  });

  it("akun pemilik menahan kata sandi pendek dan konfirmasi yang tidak sama", async () => {
    renderWizard();
    await passCodeAndOwner("pendek", "pendek");
    expect(next().hasAttribute("disabled")).toBe(true);
  });

  it("langkah perusahaan mengirim muatan baku: kode diformat, username huruf kecil tanpa spasi", async () => {
    const onComplete = renderWizard();
    await passCodeAndOwner();
    await userEvent.click(next());
    const submit = screen.getByRole("button", { name: "Siapkan perusahaan" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByLabelText("Nama badan hukum"), "PT ABC Valas");
    await userEvent.type(screen.getByLabelText("Nama dagang"), "ABC Valas");
    await userEvent.click(submit);
    expect(onComplete).toHaveBeenCalledWith({
      setupCode: "ABCD-EFGH-JKLM",
      owner: { name: "Pemilik ABC", username: "pemilik.abc", password: "Pemilik-abc-2026" },
      company: { legalEntityName: "PT ABC Valas", tradingName: "ABC Valas", licenseNumber: undefined },
    });
  });

  it("sesudah berhasil, kedelapan kode pemulihan tampil sebagai langkah terakhir", async () => {
    renderWizard();
    await passCodeAndOwner();
    await userEvent.click(next());
    await userEvent.type(screen.getByLabelText("Nama badan hukum"), "PT ABC Valas");
    await userEvent.type(screen.getByLabelText("Nama dagang"), "ABC Valas");
    await userEvent.click(screen.getByRole("button", { name: "Siapkan perusahaan" }));
    expect(await screen.findByText("NP67-QR89")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Simpan kode pemulihan Anda/ })).toBeTruthy();
  });
});
