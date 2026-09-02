import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { decodeSanctionsWatchlistUpload, parseSanctionsWatchlistWorkbook } from "./sanctionsWatchlistImport";

function workbookBuffer(sheets: { name: string; rows: unknown[][] }[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const dttotHeader = ["Nama", "Deskripsi", "Terduga", "Kode Densus", "Tempat Lahir", "Tanggal Lahir", "WN/Asal Negara", "Alamat"];

describe("parseSanctionsWatchlistWorkbook — DTTOT shape", () => {
  it("parses individual and korporasi rows, splitting embedded aliases out of the name field", () => {
    const data = workbookBuffer([{ name: "Sheet1", rows: [
      dttotHeader,
      ["FULAN BIN FULAN alias SI FULAN alias ABU CONTOH", "- keterangan uji", "Orang", "TEST-001", "Kota Uji", "01/01/1980", "Indonesia", "Jalan Uji No.1"],
      ["YAYASAN CONTOH SEJAHTERA", "- keterangan entitas uji", "Korporasi", "TEST-002", "NA", "NA", "NA", "NA"],
    ] }]);
    const result = parseSanctionsWatchlistWorkbook(data);
    expect(result.listType).toBe("DTTOT");
    expect(result.sourceLabel).toBeNull();
    expect(result.entries).toHaveLength(2);

    const [person, entity] = result.entries;
    expect(person.entityType).toBe("INDIVIDUAL");
    expect(person.fullName).toBe("FULAN BIN FULAN");
    expect(person.aliases).toBe("SI FULAN\nABU CONTOH");
    expect(person.referenceCode).toBe("TEST-001");

    expect(entity.entityType).toBe("ENTITY");
    expect(entity.fullName).toBe("YAYASAN CONTOH SEJAHTERA");
    expect(entity.dateOfBirth).toBeNull();
    expect(entity.placeOfBirth).toBeNull();
  });

  it("skips blank trailing rows", () => {
    const data = workbookBuffer([{ name: "Sheet1", rows: [dttotHeader, ["Fulan", "-", "Orang", "TEST-001", "", "", "", ""], ["", "", "", "", "", "", "", ""]] }]);
    expect(parseSanctionsWatchlistWorkbook(data).entries).toHaveLength(1);
  });

  it("rejects a DTTOT workbook with more than one sheet", () => {
    const rows = [dttotHeader, ["Fulan", "-", "Orang", "TEST-001", "", "", "", ""]];
    const data = workbookBuffer([{ name: "Sheet1", rows }, { name: "Sheet2", rows }]);
    expect(() => parseSanctionsWatchlistWorkbook(data)).toThrow(/satu lembar/);
  });
});

const pppsmOrangHeader = ["Referensi", "Nama", "Gelar", "Pekerjaan", "Tanggal Lahir", "Tempat Lahir", "Alias 1", "Alias 2", "Kewarganegaraan", "Nomor Paspor", "Nomor Identitas", "Alamat", "Informasi Lain"];
const pppsmEntitasHeader = ["Referensi", "Nama", "Alias 1", "Alias 2", "Alamat 1", "Alamat 2", "Informasi Lain"];

describe("parseSanctionsWatchlistWorkbook — PPPSM shape", () => {
  it("parses Orang and Entitas sheets, skipping the section-marker row, deriving sourceLabel from the reference-code prefix", () => {
    const data = workbookBuffer([
      { name: "Sheet1", rows: [
        pppsmOrangHeader,
        ["ZZTESTi.001", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["ZZTESTi.001", "Contoh Orang", "NA", "Pejabat uji", "1 Januari 1970", "Kota Uji", "Alias Satu", "NA", "Testland", "12345", "NA", "NA", "Keterangan uji"],
      ] },
      { name: "Sheet2", rows: [
        pppsmEntitasHeader,
        ["ZZTESTe.001", "", "", "", "", "", ""],
        ["ZZTESTe.001", "Contoh Entitas", "Alias Entitas", "NA", "Alamat Satu", "Alamat Dua", "Keterangan entitas uji"],
      ] },
    ]);
    const result = parseSanctionsWatchlistWorkbook(data);
    expect(result.listType).toBe("PPPSM");
    expect(result.sourceLabel).toBe("ZZTEST");
    expect(result.entries).toHaveLength(2);

    const [person, entity] = result.entries;
    expect(person.entityType).toBe("INDIVIDUAL");
    expect(person.fullName).toBe("Contoh Orang");
    expect(person.aliases).toBe("Alias Satu");
    expect(person.identityNumbers).toBe("Paspor: 12345");
    expect(person.description).toBe("Keterangan uji");

    expect(entity.entityType).toBe("ENTITY");
    expect(entity.fullName).toBe("Contoh Entitas");
    expect(entity.aliases).toBe("Alias Entitas");
    expect(entity.address).toBe("Alamat Satu\nAlamat Dua");
  });

  it("rejects a workbook whose reference codes mix more than one sub-list prefix", () => {
    const data = workbookBuffer([{ name: "Sheet1", rows: [
      pppsmOrangHeader,
      ["AAAi.001", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["AAAi.001", "Orang A", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA"],
      ["BBBi.001", "Orang B", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA"],
    ] }]);
    expect(() => parseSanctionsWatchlistWorkbook(data)).toThrow(/satu sumber daftar/);
  });

  it("rejects an unrecognized workbook shape", () => {
    const data = workbookBuffer([{ name: "Sheet1", rows: [["Kolom Acak", "Lainnya"], ["nilai", "lain"]] }]);
    expect(() => parseSanctionsWatchlistWorkbook(data)).toThrow(/tidak dikenali/);
  });
});

describe("decodeSanctionsWatchlistUpload", () => {
  it("rejects a non-spreadsheet MIME type", () => {
    expect(() => decodeSanctionsWatchlistUpload({ dataBase64: Buffer.from("test").toString("base64"), mimeType: "text/plain", byteSize: 4 })).toThrow(/XLSX atau XLS/);
  });

  it("rejects when the declared byteSize doesn't match the decoded payload", () => {
    const base64 = Buffer.from("test-data").toString("base64");
    expect(() => decodeSanctionsWatchlistUpload({ dataBase64: base64, mimeType: "application/vnd.ms-excel", byteSize: 999 })).toThrow(/tidak konsisten/);
  });
});
