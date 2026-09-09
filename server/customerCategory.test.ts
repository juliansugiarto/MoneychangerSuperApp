import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { createCustomer, updateCustomer } from "./operations";
import { customerInput, customerUpdateInput } from "./routers";
import { v1Fixtures } from "./v1Fixtures";

/**
 * Jenis nasabah, bentuk badan hukum, dan kategori pekerjaan pada borang nasabah.
 *
 * Ketiganya kolom penulis bagi parameter badan usaha dan profesi Form C1; aturan CLAUDE.md "Fitur
 * Harus Punya Sumber Data" menuntut penulisnya ada sebelum pembacanya dibangun.
 */

/** Nasabah lama yang sudah berkategori — dipakai membuktikan penyuntingan tidak mengosongkannya. */
const existingCustomer = {
  id: 1, cifNumber: "CIF-0001", fullName: "Nasabah Lama", phoneNumber: "0811", identityType: "KTP" as const, identityNumber: "1234",
  identityExpiryDate: null, placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama", addressType: "RUMAH" as const, addressCountry: "ID", addressProvince: null, addressCity: "Jakarta",
  addressDistrict: null, addressPostalCode: null, npwp: null, occupation: "Karyawan pabrik tekstil",
  sourceOfFunds: "Gaji", transactionPurpose: "Liburan", profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, riskNotes: null,
  pepStatus: "NONE" as const, pepDetails: null, dttotPpsdmMatch: false, dttotPpsdmNotes: null, isDemo: false, isHistorical: false,
  declaredMonthlyValueIdr: null, declaredMonthlyCount: null, declaredCurrencies: null,
  customerType: "INDIVIDU" as const, entityLegalForm: null, occupationCategory: "KARYAWAN_SWASTA" as const,
};

const knownCurrencies = [{ id: 1, code: "USD", name: "Dolar Amerika Serikat", active: true }];

function makeReader(rows: unknown[]): Record<string, unknown> & PromiseLike<unknown[]> {
  return {
    from: () => makeReader(rows),
    where: () => makeReader(rows),
    limit: () => makeReader(rows),
    orderBy: () => makeReader(rows),
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

function mockDb(existing: Record<string, unknown> = existingCustomer) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const reader = (table: unknown) => {
    const name = String((table as { [k: symbol]: unknown })?.[Symbol.for("drizzle:Name")] ?? "");
    return makeReader(name === "currencies" ? knownCurrencies : [existing]);
  };
  const fakeDb: Record<string, unknown> = {
    select: vi.fn(() => ({ from: (table: unknown) => reader(table) })),
    insert: vi.fn(() => ({ values: (values: Record<string, unknown>) => { inserted.push(values); return Promise.resolve(undefined); } })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updated.push(values); return { where: () => Promise.resolve(undefined) }; } })),
  };
  fakeDb.transaction = vi.fn((run: (tx: unknown) => Promise<unknown>) => run(fakeDb));
  vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
  return { inserted, updated };
}

const updateBase = {
  customerId: 1, fullName: "Nasabah Lama", phoneNumber: "081100000000", identityType: "KTP" as const, identityNumber: "1234",
  placeOfBirth: "Jakarta", dateOfBirth: new Date("1990-01-01"), gender: "MALE" as const, nationality: "ID",
  address: "Jl. Lama Nomor 1", addressType: "RUMAH" as const, addressCountry: "ID", addressCity: "Jakarta",
  occupation: "Karyawan pabrik tekstil", sourceOfFunds: "Gaji", transactionPurpose: "Liburan",
  profileStatus: "ACTIVE" as const, riskLevel: "LOW" as const, pepStatus: "NONE" as const, dttotPpsdmMatch: false,
  changeReason: "nasabah memperbarui nomor telepon",
};

const actor = { id: 3, role: "ADMIN" as const };

describe("kategori nasabah pada borang", () => {
  it("menyimpan customerType, entityLegalForm, dan occupationCategory saat dibuat", async () => {
    const { inserted } = mockDb();
    const parsed = customerInput.parse({
      ...v1Fixtures.customer,
      customerType: "BADAN_USAHA",
      entityLegalForm: "PT",
      occupation: "Perseroan terbatas bidang tekstil",
    });
    await createCustomer(parsed as never, 3);

    const baris = inserted.find((values) => "cifNumber" in values);
    expect(baris?.customerType).toBe("BADAN_USAHA");
    expect(baris?.entityLegalForm).toBe("PT");
  });

  it("menyimpan kategori pekerjaan nasabah perorangan saat dibuat", async () => {
    const { inserted } = mockDb();
    const parsed = customerInput.parse({
      ...v1Fixtures.customer,
      customerType: "INDIVIDU",
      occupationCategory: "WIRAUSAHA",
    });
    await createCustomer(parsed as never, 3);

    const baris = inserted.find((values) => "cifNumber" in values);
    expect(baris?.customerType).toBe("INDIVIDU");
    expect(baris?.occupationCategory).toBe("WIRAUSAHA");
    expect(baris?.entityLegalForm).toBeNull();
  });

  it("menuntut entityLegalForm ketika customerType BADAN_USAHA", () => {
    const hasil = customerInput.safeParse({ ...v1Fixtures.customer, customerType: "BADAN_USAHA" });
    expect(hasil.success).toBe(false);
    expect(JSON.stringify(hasil.error?.issues)).toMatch(/bentuk badan hukum/i);
  });

  it("menolak entityLegalForm ketika customerType INDIVIDU", () => {
    const hasil = customerInput.safeParse({ ...v1Fixtures.customer, customerType: "INDIVIDU", entityLegalForm: "PT" });
    expect(hasil.success).toBe(false);
    expect(JSON.stringify(hasil.error?.issues)).toMatch(/perorangan/i);
  });

  /**
   * Inti tugas ini. Ketiga kolom deklarasi Paket H berperilaku sebaliknya — yang tidak dikirim akan
   * dikosongkan — dan itu disengaja di sana karena borangnya selalu mengirim ketiganya. Kolom
   * kategori tidak boleh mengikuti pola itu: nasabah lama yang disunting karena alasan lain,
   * misalnya berganti nomor telepon, tidak boleh kehilangan kategorinya tanpa ada yang meminta.
   */
  it("penyuntingan yang tidak mengirim occupationCategory TIDAK mengosongkannya", async () => {
    const { updated } = mockDb();
    const parsed = customerUpdateInput.parse(updateBase);
    await updateCustomer(parsed as never, actor);

    expect(updated[0].occupationCategory).toBe("KARYAWAN_SWASTA");
    expect(updated[0].customerType).toBe("INDIVIDU");
  });

  it("penyuntingan yang mengirim null eksplisit MENGOSONGKANNYA", async () => {
    const { updated } = mockDb();
    const parsed = customerUpdateInput.parse({ ...updateBase, occupationCategory: null });
    await updateCustomer(parsed as never, actor);

    // Petugas yang salah pilih kategori harus dapat membatalkannya; yang tidak boleh adalah
    // kekosongan yang terjadi tanpa ada yang memintanya.
    expect(updated[0].occupationCategory).toBeNull();
  });

  it("occupation teks bebas tetap tersimpan apa adanya", async () => {
    const { updated } = mockDb();
    const parsed = customerUpdateInput.parse({ ...updateBase, occupationCategory: "BURUH" });
    await updateCustomer(parsed as never, actor);

    // Kategori tertutup berdampingan dengan teks bebas, tidak menggantikannya: kwitansi dan ekspor
    // goAML mencetak kata-kata sebagaimana tertulis pada KTP.
    expect(updated[0].occupation).toBe("Karyawan pabrik tekstil");
    expect(updated[0].occupationCategory).toBe("BURUH");
  });

  it("berganti ke BADAN_USAHA mengosongkan kategori pekerjaan, dan sebaliknya", async () => {
    const { updated } = mockDb();
    const parsed = customerUpdateInput.parse({ ...updateBase, customerType: "BADAN_USAHA", entityLegalForm: "CV" });
    await updateCustomer(parsed as never, actor);

    // Baris yang sekaligus badan usaha dan berkategori pekerjaan perorangan akan membuat komposisi
    // profesi Form C1 menghitung korporasi sebagai orang.
    expect(updated[0].entityLegalForm).toBe("CV");
    expect(updated[0].occupationCategory).toBeNull();
  });

  it("nasabah lama tanpa kategori tetap tanpa kategori setelah disunting", async () => {
    const { updated } = mockDb({ ...existingCustomer, customerType: null, entityLegalForm: null, occupationCategory: null });
    const parsed = customerUpdateInput.parse(updateBase);
    await updateCustomer(parsed as never, actor);

    // Tidak ada backfill otomatis — keputusan pengguna 6. Menebak kategori dari teks bebas
    // "Karyawan pabrik tekstil" berarti mengarang data nasabah.
    expect(updated[0].customerType).toBeNull();
    expect(updated[0].occupationCategory).toBeNull();
  });
});
