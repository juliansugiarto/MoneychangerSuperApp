/**
 * Peragaan menyeluruh Paket L pada basis data lokal — jejak penyaringan nasabah dan gerbang
 * persetujuan nasabah berisiko tinggi.
 *
 * Menjalankan rantai lengkapnya di basis data `moneychanger` dan mencetak buktinya:
 * nasabah dibuat → baris penyaringan otomatis → daftar diimpor ulang → baris kedua dengan
 * `listSnapshotAt` baru → risiko dinaikkan menjadi HIGH → bon **ditolak** → Pemegang Saham
 * menyetujui → bon **berhasil**.
 *
 * Hanya untuk basis data lokal. Impor ulangnya menulis kembali entri DTTOT yang sedang ada apa
 * adanya (nama, alias, dan kode yang sama), sehingga data peragaan paket sebelumnya tidak hilang —
 * yang berubah hanya `importedAt`, dan justru itulah yang hendak diperagakan.
 *
 * Jalankan: ./node_modules/.bin/tsx scripts/peragaanPaketL.mts
 */
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { sanctionsWatchlistEntries } from "../drizzle/schema";
import { decideHighRisk } from "../server/customerHighRiskApproval";
import { listCustomerScreenings } from "../server/customerWatchlistScreening";
import { getDb } from "../server/db";
import {
  createCustomer,
  createTransaction,
  getNextCifNumber,
  importSanctionsWatchlist,
  updateCustomer,
  type CustomerInput,
} from "../server/operations";
import { v1Fixtures } from "../server/v1Fixtures";

if (process.env.NODE_ENV === "production") throw new Error("Peragaan ini hanya untuk basis data lokal.");

const langkah = (nomor: number, judul: string) => console.log(`\n=== ${nomor}. ${judul} ===`);
const waktu = (value: Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value) + " WIB" : "—";

async function cetakRiwayat(customerId: number) {
  const riwayat = await listCustomerScreenings(customerId);
  console.log(`   daftar terbaru diimpor : ${waktu(riwayat.latestImportAt)}`);
  console.log(`   penyaringan usang?     : ${riwayat.isStale ? "YA" : "tidak"}`);
  for (const row of riwayat.screenings) {
    console.log(`   - ${waktu(row.screenedAt)} · ${row.trigger} · oleh ${row.screenedByUserId ? `#${row.screenedByUserId}` : "sistem"} · cocok ${row.matchCount} · daftar ${waktu(row.listSnapshotAt)}`);
    if (row.summary) console.log(`     ringkasan: ${row.summary}`);
  }
  return riwayat;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Basis data lokal tidak tersedia.");

  const STAF = 3;
  const PEMEGANG_SAHAM = 1;
  const stempel = Date.now().toString().slice(-6);

  langkah(1, "Nasabah dibuat — baris penyaringan otomatis muncul");
  const cif = await getNextCifNumber();
  const input: CustomerInput = {
    ...v1Fixtures.customer,
    cifNumber: cif,
    // Nama yang sama persis dengan salah satu entri DTTOT yang sedang termuat, supaya
    // kemungkinan cocoknya terlihat — dan tetap TIDAK mengubah kotak centang DTTOT/DPPSPM.
    fullName: "Contoh Peragaan DTTOT Individu 1",
    identityNumber: `3174${stempel}0001`,
  };
  const nasabah = await createCustomer(input, STAF);
  console.log(`   nasabah #${nasabah.id} ${nasabah.cifNumber} — ${nasabah.fullName}`);
  console.log(`   dttotPpsdmMatch tetap  : ${nasabah.dttotPpsdmMatch} (mesin tidak pernah mengisinya)`);
  await cetakRiwayat(nasabah.id);

  langkah(2, "Daftar DTTOT diimpor ulang — baris kedua dengan listSnapshotAt baru");
  const entriDttot = await db.select().from(sanctionsWatchlistEntries).where(eq(sanctionsWatchlistEntries.listType, "DTTOT"));
  const barisWorkbook = [
    ["Nama", "Deskripsi", "Terduga", "Kode Densus", "Tempat Lahir", "Tanggal Lahir", "WN/Asal Negara", "Alamat"],
    ...entriDttot.map((entri) => [
      [entri.fullName, ...(entri.aliases ? entri.aliases.split("\n") : [])].join(" alias "),
      entri.description ?? "",
      entri.entityType === "ENTITY" ? "Korporasi" : "Orang",
      entri.referenceCode ?? "",
      entri.placeOfBirth ?? "", entri.dateOfBirth ?? "", entri.nationality ?? "", entri.address ?? "",
    ]),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(barisWorkbook), "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const hasilImpor = await importSanctionsWatchlist({
    dataBase64: buffer.toString("base64"), originalFileName: "peragaan-paket-l-dttot.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: buffer.byteLength, actorUserId: STAF,
  });
  console.log(`   ${hasilImpor.listType} diimpor ulang: ${hasilImpor.recordCount} entri`);
  await cetakRiwayat(nasabah.id);

  langkah(3, "Risiko dinaikkan menjadi HIGH — keputusan disetel ulang ke BELUM");
  const dinaikkan = await updateCustomer({
    customerId: nasabah.id, changeReason: "Peragaan Paket L: menaikkan tingkat risiko menjadi tinggi.",
    fullName: nasabah.fullName, phoneNumber: nasabah.phoneNumber, identityType: nasabah.identityType, identityNumber: nasabah.identityNumber,
    placeOfBirth: nasabah.placeOfBirth ?? "Jakarta", dateOfBirth: nasabah.dateOfBirth ?? new Date("1990-01-01"),
    address: nasabah.address, addressType: nasabah.addressType ?? "RUMAH", addressCountry: nasabah.addressCountry ?? "ID",
    addressCity: nasabah.addressCity ?? "Jakarta", nationality: nasabah.nationality ?? "ID", gender: nasabah.gender ?? "MALE",
    occupation: nasabah.occupation ?? "Wiraswasta", sourceOfFunds: nasabah.sourceOfFunds ?? "Usaha", transactionPurpose: nasabah.transactionPurpose ?? "Kebutuhan pribadi",
    profileStatus: "ACTIVE", riskLevel: "HIGH", pepStatus: "NONE", dttotPpsdmMatch: false,
  }, { id: STAF, role: "ADMIN" });
  console.log(`   riskLevel ${dinaikkan.riskLevel} · highRiskDecision ${dinaikkan.highRiskDecision}`);
  await cetakRiwayat(nasabah.id);

  const bon = (receiptNumber: string) => createTransaction({
    operation: "BUY", customerId: nasabah.id, receiptNumber,
    lines: [{ currencyId: 7, denominations: [{ value: "100", quantity: 1, rate: "16000" }] }],
    paymentMethod: "CASH", paymentDenominations: [{ value: "100000", quantity: 16 }],
    transactionAt: new Date(),
  }, STAF);

  langkah(4, "Bon dicoba — harus DITOLAK");
  try {
    await bon(`L-${stempel}-1`);
    console.log("   !!! bon justru berhasil — gerbangnya TIDAK bekerja");
    process.exitCode = 1;
  } catch (error) {
    console.log(`   ditolak: ${error instanceof Error ? error.message : String(error)}`);
  }

  langkah(5, "Pemegang Saham menyetujui");
  const diputuskan = await decideHighRisk(
    { customerId: nasabah.id, decision: "DISETUJUI", notes: "Peragaan Paket L: sumber dana terverifikasi." },
    { id: PEMEGANG_SAHAM, role: "SHAREHOLDER" },
  );
  console.log(`   highRiskDecision ${diputuskan.highRiskDecision} oleh #${diputuskan.highRiskDecidedByUserId} pada ${waktu(diputuskan.highRiskDecidedAt)}`);

  langkah(6, "Bon dicoba lagi — harus BERHASIL");
  const berhasil = await bon(`L-${stempel}-2`);
  console.log(`   bon #${berhasil.id} nomor kwitansi ${berhasil.receiptNumber} status ${berhasil.status} Rp ${berhasil.rupiahAmount}`);

  console.log("\nSelesai. Nasabah peragaan:", nasabah.id, nasabah.cifNumber);
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error) => { console.error(error); process.exit(1); });
