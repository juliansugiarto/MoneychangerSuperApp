import { describe, expect, it } from "vitest";
import { CHART_OF_ACCOUNTS, findAccount } from "./chartOfAccounts";
import {
  EQUITY_MEASURE_ACCOUNTS,
  REGULATORY_FORMS,
  formMatchKey,
  groupHeadingFor,
  isValueCell,
  normalizeFormLabel,
  recordRows,
  renderFormLabel,
  type FormColumn,
  type RegulatoryForm,
} from "./regulatoryForms";

const form = (code: RegulatoryForm["code"]) => REGULATORY_FORMS.find((candidate) => candidate.code === code)!;

describe("struktur form regulator", () => {
  it("memuat ketiga form dengan Jumlah Record seperti pada headernya", () => {
    expect(REGULATORY_FORMS.map((item) => [item.code, item.recordCount])).toEqual([
      ["B0002", 19],
      ["B0003", 25],
      ["B0004", 7],
    ]);
  });

  it("punya jumlah baris berisi yang sama dengan Jumlah Record", () => {
    for (const item of REGULATORY_FORMS) {
      expect(recordRows(item), `Jumlah Record ${item.code}`).toHaveLength(item.recordCount);
    }
  });

  it("tidak punya kunci baris ganda dalam satu form", () => {
    for (const item of REGULATORY_FORMS) {
      const keys = item.rows.map((row) => row.key);
      expect(new Set(keys).size, `kunci ganda pada ${item.code}`).toBe(keys.length);
    }
  });

  it("hanya menunjuk akun yang ada pada bagan akun dan memang dipetakan ke form itu", () => {
    for (const item of REGULATORY_FORMS) {
      for (const row of item.rows) {
        for (const cell of row.cells) {
          if (cell.source.kind !== "AKUN" && cell.source.kind !== "SISI") continue;
          const account = findAccount(cell.source.code);
          expect(account, `${item.code}/${row.key} menunjuk ${cell.source.code}`).not.toBeNull();
          expect(account!.forms, `${cell.source.code} tidak dipetakan ke ${item.code}`).toContain(item.code);
        }
      }
    }
  });

  it("memberi setiap akun B0002 dan B0003 tepat satu tempat pada formnya", () => {
    for (const code of ["B0002", "B0003"] as const) {
      const item = form(code);
      const used = new Set(
        item.rows.flatMap((row) =>
          row.cells.flatMap((cell) => {
            if (cell.source.kind === "AKUN" || cell.source.kind === "SISI") return [cell.source.code];
            if (cell.source.kind === "EKUITAS") return EQUITY_MEASURE_ACCOUNTS[cell.source.measure];
            return [];
          }),
        ),
      );
      // Setiap akun yang bagan akun petakan ke form ini wajib punya tempatnya. Akun lain boleh ikut
      // tertelusur — dividen `3-4100` misalnya mempengaruhi laba ditahan akhir pada B0002 meski
      // barisnya sendiri berada di B0004 — tetapi tidak boleh ada yang hilang.
      const expected = CHART_OF_ACCOUNTS.filter((account) => account.forms.includes(code)).map((account) => account.code);
      const missing = expected.filter((account) => !used.has(account));
      expect(missing, `akun ${code} tanpa tempat pada formnya`).toEqual([]);
    }
  });

  it("memberi setiap baris B0002 sebuah sisi kiri atau kanan, dan hanya B0002", () => {
    expect(form("B0002").rows.every((row) => row.side === "KIRI" || row.side === "KANAN")).toBe(true);
    expect(form("B0003").rows.every((row) => row.side === undefined)).toBe(true);
    expect(form("B0004").rows.every((row) => row.side === undefined)).toBe(true);
  });

  it("membuat subtotal hanya dari sel yang ada, tanpa lingkaran perhitungan", () => {
    // B0004 mencetak baris "(net)" di ATAS rinciannya, jadi urutan cetak tidak dapat dipakai
    // sebagai aturan. Yang harus dijamin adalah setiap subtotal dapat dihitung sampai selesai:
    // selnya ada, dan tidak ada satu pun yang menunggu dirinya sendiri.
    for (const item of REGULATORY_FORMS) {
      const byKey = new Map(item.rows.map((row) => [row.key, row]));
      const node = (key: string, column: FormColumn) => `${key}:${column}`;
      const dependencies = new Map<string, string[]>();

      for (const row of item.rows) {
        for (const cell of row.cells) {
          if (cell.source.kind !== "SUBTOTAL") continue;
          expect(cell.source.of.length, `${item.code}/${row.key} subtotal kosong`).toBeGreaterThan(0);
          const terms: string[] = [];
          for (const term of cell.source.of) {
            const target = byKey.get(term.key);
            expect(target, `${item.code}/${row.key} menunjuk ${term.key} yang tidak ada`).toBeDefined();
            const columns = target!.cells.map((candidate) => candidate.column);
            const chosen: FormColumn | undefined = term.column ?? columns[0];
            expect(columns, `${item.code}/${row.key} menunjuk kolom ${chosen} pada ${term.key}`).toContain(chosen);
            terms.push(node(term.key, chosen!));
          }
          dependencies.set(node(row.key, cell.column), terms);
        }
      }

      const state = new Map<string, "MENGHITUNG" | "SELESAI">();
      const walk = (current: string, trail: string[]) => {
        if (state.get(current) === "SELESAI") return;
        expect(state.get(current), `${item.code}: lingkaran perhitungan ${[...trail, current].join(" -> ")}`).not.toBe("MENGHITUNG");
        state.set(current, "MENGHITUNG");
        for (const next of dependencies.get(current) ?? []) walk(next, [...trail, current]);
        state.set(current, "SELESAI");
      };
      for (const key of dependencies.keys()) walk(key, []);
    }
  });

  it("menuntut kolom rujukan bila baris yang ditunjuk punya lebih dari satu kolom nilai", () => {
    for (const item of REGULATORY_FORMS) {
      const byKey = new Map(item.rows.map((row) => [row.key, row]));
      for (const row of item.rows) {
        for (const cell of row.cells) {
          if (cell.source.kind !== "SUBTOTAL") continue;
          for (const term of cell.source.of) {
            if ((byKey.get(term.key)?.cells.length ?? 0) > 1) {
              expect(term.column, `${item.code}/${row.key} menunjuk ${term.key} tanpa menyebut kolom`).toBeDefined();
            }
          }
        }
      }
    }
  });

  it("hanya menandai baris berisi sebagai selalu nol", () => {
    for (const item of REGULATORY_FORMS) {
      for (const row of item.rows) {
        if (!row.alwaysZeroReason) continue;
        expect(row.cells.some(isValueCell), `${item.code}/${row.key}`).toBe(true);
        expect(row.alwaysZeroReason.length).toBeGreaterThan(20);
      }
    }
  });

  it("memisahkan sisi positif dan negatif dari saldo yang sama secara berpasangan", () => {
    for (const item of REGULATORY_FORMS) {
      const sides = new Map<string, Set<string>>();
      for (const row of item.rows) {
        for (const cell of row.cells) {
          if (cell.source.kind === "SISI") {
            const bucket = sides.get(cell.source.code) ?? new Set();
            bucket.add(cell.source.side);
            sides.set(cell.source.code, bucket);
          }
          if (cell.source.kind === "EKUITAS" && cell.source.side) {
            const bucket = sides.get(cell.source.measure) ?? new Set();
            bucket.add(cell.source.side);
            sides.set(cell.source.measure, bucket);
          }
        }
      }
      for (const [subject, bucket] of sides) {
        expect([...bucket].sort(), `${item.code}/${subject} kehilangan salah satu sisinya`).toEqual(["NEGATIF", "POSITIF"]);
      }
    }
  });
});

describe("pencocokan label", () => {
  it("membuang penanda tanda kurang, penanda net, dan tahun", () => {
    expect(normalizeFormLabel("Akum.Penyusutan (-/-)")).toBe("akum penyusutan");
    expect(normalizeFormLabel("Harga Perolehan ( - )")).toBe("harga perolehan");
    expect(normalizeFormLabel("Taksiran Pajak Penghasilan (-)")).toBe("taksiran pajak penghasilan");
    expect(normalizeFormLabel("Saldo per tgl 31 Des 200X-1 (net)")).toBe("saldo per tgl des");
    expect(normalizeFormLabel("Saldo per tgl 31 Des {TAHUN-1} (net)")).toBe("saldo per tgl des");
  });

  it("mengenali label kembar hanya lewat judul kelompoknya", () => {
    const b0003 = form("B0003");
    const labels = b0003.rows.filter((row) => row.cells.some(isValueCell)).map((row) => normalizeFormLabel(row.label));
    expect(labels.filter((label) => label === "laba")).toHaveLength(2);

    const keys = b0003.rows.map((row, index) => (row.cells.some(isValueCell) ? formMatchKey(groupHeadingFor(b0003, index), row.label) : null)).filter(Boolean);
    expect(new Set(keys).size, "pasangan judul+label harus unik").toBe(keys.length);
  });

  it("membuat pasangan judul dan label yang unik pada ketiga form", () => {
    for (const item of REGULATORY_FORMS) {
      const keys = item.rows
        .map((row, index) => (row.cells.some(isValueCell) ? formMatchKey(groupHeadingFor(item, index), row.label) : null))
        .filter((key): key is string => key !== null);
      expect(new Set(keys).size, `pasangan judul+label pada ${item.code}`).toBe(keys.length);
    }
  });

  it("membedakan dua baris Bank pada B0002 lewat judul kelompoknya", () => {
    const b0002 = form("B0002");
    const bankRows = b0002.rows.map((row, index) => ({ row, index })).filter(({ row }) => row.label === "Bank");
    expect(bankRows).toHaveLength(2);
    expect(bankRows.map(({ index }) => groupHeadingFor(b0002, index))).toEqual(["Kas dan Bank dalam Rp", "Kas dan Bank dalam UKA"]);
  });

  it("mengganti penanda tahun pada label saldo B0004", () => {
    expect(renderFormLabel("Saldo per tgl 31 Des {TAHUN-1} (net)", 2025)).toBe("Saldo per tgl 31 Des 2024 (net)");
    expect(renderFormLabel("Saldo per tanggal 31 Des {TAHUN}", 2025)).toBe("Saldo per tanggal 31 Des 2025");
  });
});
