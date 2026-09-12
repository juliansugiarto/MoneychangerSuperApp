import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./DataTable";
import { FormSection, StickyActions } from "./FormSection";
import { ListDetailLayout } from "./ListDetailLayout";
import { ReportLayout } from "./ReportLayout";
import { StepFlow } from "./StepFlow";

type Bon = { id: string; nomor: string; nilai: string };
const bons: Bon[] = [
  { id: "1", nomor: "FX-001", nilai: "Rp 1.500.000" },
  { id: "2", nomor: "FX-002", nilai: "Rp 250.000" },
];
const columns: Column<Bon>[] = [
  { key: "nomor", header: "Nomor bon", cell: (row) => row.nomor },
  { key: "nilai", header: "Nilai", cell: (row) => row.nilai, align: "right" },
];

describe("DataTable", () => {
  it("memilih baris dengan klik maupun Enter", async () => {
    const onSelect = vi.fn();
    render(<DataTable columns={columns} rows={bons} rowKey={(row) => row.id} onSelect={onSelect} caption="Daftar bon" />);
    await userEvent.click(screen.getByText("FX-001"));
    expect(onSelect).toHaveBeenLastCalledWith(bons[0]);
    const secondRow = screen.getByText("FX-002").closest("tr")!;
    secondRow.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(bons[1]);
  });

  it("menandai baris terpilih dan meratakan angka ke kanan", () => {
    render(<DataTable columns={columns} rows={bons} rowKey={(row) => row.id} onSelect={() => {}} selectedKey="2" />);
    expect(screen.getByText("FX-002").closest("tr")!.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Rp 250.000").className).toContain("text-right");
  });
});

describe("ListDetailLayout", () => {
  it("Esc menutup panel detail yang terbuka", async () => {
    const onClose = vi.fn();
    render(<ListDetailLayout list={<p>daftar</p>} detail={<p>isi</p>} detailTitle="Bon FX-001" onCloseDetail={onClose} />);
    expect(screen.getByRole("complementary", { name: "Bon FX-001" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Esc tidak memanggil apa pun saat detail tertutup", async () => {
    const onClose = vi.fn();
    render(<ListDetailLayout list={<p>daftar</p>} onCloseDetail={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("StepFlow", () => {
  const steps = [
    { id: "usaha", title: "Tentang usaha Anda" },
    { id: "nasabah", title: "Nasabah, produk, wilayah" },
    { id: "hasil", title: "Hasil" },
  ];

  it("menandai langkah aktif dan mematikan Kembali pada langkah pertama", async () => {
    const onStepChange = vi.fn();
    render(<StepFlow steps={steps} currentIndex={0} onStepChange={onStepChange}><p>isi</p></StepFlow>);
    expect(screen.getByText("Tentang usaha Anda").closest("li")!.getAttribute("aria-current")).toBe("step");
    expect((screen.getByRole("button", { name: "Kembali" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it("tidak menampilkan Lanjut pada langkah terakhir, dan canAdvance=false mematikannya", () => {
    const { rerender } = render(<StepFlow steps={steps} currentIndex={2} onStepChange={() => {}}><p>isi</p></StepFlow>);
    expect(screen.queryByRole("button", { name: "Lanjut" })).toBeNull();
    rerender(<StepFlow steps={steps} currentIndex={1} onStepChange={() => {}} canAdvance={false}><p>isi</p></StepFlow>);
    expect((screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("FormSection dan ReportLayout", () => {
  it("bagian formulir bernomor dan berlabel", () => {
    render(<FormSection number={2} title="Data identitas"><input aria-label="NIK" /></FormSection>);
    expect(screen.getByRole("region", { name: "2. Data identitas" })).toBeTruthy();
    render(<StickyActions><button type="button">Simpan</button></StickyActions>);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
  });

  it("laporan menjalankan ekspor", async () => {
    const onExport = vi.fn();
    render(<ReportLayout table={<p>tabel</p>} onExport={onExport} exportLabel="Ekspor Excel" />);
    await userEvent.click(screen.getByRole("button", { name: "Ekspor Excel" }));
    expect(onExport).toHaveBeenCalledOnce();
  });
});
