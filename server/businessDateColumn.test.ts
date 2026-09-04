import { describe, expect, it } from "vitest";
import { jakartaBusinessDate, jakartaBusinessDateColumn } from "./operations";

/**
 * Persis seperti mysql2 mengirimkan sebuah `Date`: komponen waktu **lokal** proses, lengkap dengan
 * jamnya. Bagian jam inilah yang menentukan — kolom `date` bernilai '2026-09-02' dibandingkan
 * dengan '2026-09-02 07:00:00' tidak pernah cocok, meski bagian tanggalnya sama persis.
 *
 * Karena itu asersinya atas bentuk ini, bukan atas `toISOString()`: keduanya berbeda tepat pada
 * mesin yang bermasalah, dan `toISOString()` justru menyembunyikan selisihnya.
 */
function asMysqlValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return `${day} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

describe("hari usaha Jakarta sebagai nilai kolom date", () => {
  it("mengirim hari kalender Jakarta pada tengah malam lokal", () => {
    // 20:00 UTC adalah pukul 03:00 keesokan harinya di Jakarta.
    expect(asMysqlValue(jakartaBusinessDateColumn(new Date("2026-09-01T20:00:00Z")))).toBe("2026-09-02 00:00:00");
  });

  it("tetap benar pada tengah malam Jakarta, batas yang paling mudah meleset", () => {
    // 17:00 UTC adalah tepat tengah malam awal 2 September di Jakarta.
    expect(asMysqlValue(jakartaBusinessDateColumn(new Date("2026-09-01T17:00:00Z")))).toBe("2026-09-02 00:00:00");
    // Satu detik sebelumnya masih 1 September.
    expect(asMysqlValue(jakartaBusinessDateColumn(new Date("2026-09-01T16:59:59Z")))).toBe("2026-09-01 00:00:00");
  });

  it("berjam nol secara lokal, bukan sekadar bertanggal benar", () => {
    // Inilah asersi yang benar-benar menjaga. Nilai lama — tengah malam UTC — punya bagian TANGGAL
    // lokal yang sama persis di WIB, dan hanya berbeda pada jamnya (07:00). Menguji tanggalnya saja
    // akan lolos terhadap bug yang justru ingin dicegah berkas ini.
    const column = jakartaBusinessDateColumn(new Date("2026-09-01T20:00:00Z"));
    expect([column.getHours(), column.getMinutes(), column.getSeconds(), column.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it("membiarkan jakartaBusinessDate tetap tengah malam UTC bagi pemanggil datetime", () => {
    // Pemanggil seperti getOperationalDashboard memakainya sebagai batas datetime, dan
    // reverseJournalEntry menyerahkannya ke insertJournal yang menormalkannya sendiri lewat dbDate.
    // Mengubah fungsi ini akan menggeser batas dasbor, tutup buku, opname, dan checklist sekaligus.
    expect(jakartaBusinessDate(new Date("2026-09-01T20:00:00Z")).toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });
});
