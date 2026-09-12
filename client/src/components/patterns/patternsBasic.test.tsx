import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";
import { EmptyState, ErrorState, LoadingState } from "./PageStates";
import { StatTile } from "./StatTile";

describe("PageHeader", () => {
  it("menampilkan judul biasa dengan istilah resmi sebagai label kecil di bawahnya", () => {
    render(<PageHeader title="Seberapa berisiko usaha Anda?" officialLabel="Form A1 · Risiko inheren" description="Jawab dari data bulan ini." />);
    expect(screen.getByRole("heading", { level: 1, name: "Seberapa berisiko usaha Anda?" })).toBeTruthy();
    expect(screen.getByText("Form A1 · Risiko inheren")).toBeTruthy();
    expect(screen.getByText("Jawab dari data bulan ini.")).toBeTruthy();
  });
});

describe("keadaan halaman", () => {
  it("LoadingState diumumkan sebagai status", () => {
    render(<LoadingState label="Memuat daftar nasabah" />);
    expect(screen.getByRole("status", { name: "Memuat daftar nasabah" })).toBeTruthy();
  });

  it("EmptyState menyebut langkah berikutnya dan menjalankan tindakannya", async () => {
    const onAction = vi.fn();
    render(<EmptyState title="Belum ada kas awal hari ini" nextStep="Hitung uang di laci lalu catat sebelum melayani nasabah." actionLabel="Catat kas awal" onAction={onAction} />);
    expect(screen.getByText("Hitung uang di laci lalu catat sebelum melayani nasabah.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Catat kas awal" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("EmptyState tanpa tindakan tidak merender tombol kosong", () => {
    render(<EmptyState title="Tidak ada transaksi" nextStep="Transaksi yang dibuat hari ini akan muncul di sini." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ErrorState menyebut apa yang terjadi, langkah berikutnya, dan dapat dicoba lagi", async () => {
    const onRetry = vi.fn();
    render(<ErrorState what="Daftar kurs tidak dapat dimuat." nextStep="Periksa sambungan lalu coba lagi." onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Daftar kurs tidak dapat dimuat.");
    expect(alert.textContent).toContain("Periksa sambungan lalu coba lagi.");
    await userEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("StatTile", () => {
  it("menjadi tombol bila dapat dibuka", async () => {
    const onOpen = vi.fn();
    render(<StatTile label="Transaksi hari ini" value="12" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /Transaksi hari ini/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("bukan tombol bila hanya menampilkan angka", () => {
    render(<StatTile label="Kas Rupiah" value="Rp 25.000.000" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Rp 25.000.000")).toBeTruthy();
  });
});
