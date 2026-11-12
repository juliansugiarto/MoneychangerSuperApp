/**
 * Kalimat aturan dan pernyataan nasabah di kaki kwitansi.
 *
 * Ambang underlying (USD 10.000 sebulan sejak 1 Juli 2026) hanya berlaku atas pembelian valas oleh
 * nasabah, yaitu kwitansi JUAL kita. Pada pembelian di bawah ambang nasabah wajib menandatangani
 * pernyataan bahwa total pembeliannya bulan ini belum melebihi ambang; tanda tangannya ada di kotak
 * "Nasabah" kwitansi yang sama.
 */
export function notaStatement(transaction: { operation: "BUY" | "SELL"; underlyingRequired?: boolean | null }): string {
  const identity = "Sesuai ketentuan Bank Indonesia, nasabah wajib memberikan fotokopi kartu identitas.";
  if (transaction.operation !== "SELL") return identity;
  const rule = "Pembelian valuta asing di atas USD 10.000 atau ekuivalennya dalam satu bulan wajib disertai dokumen pendukung (underlying).";
  if (transaction.underlyingRequired) return `${identity} ${rule} Pembelian ini disertai dokumen pendukung.`;
  return `${identity} ${rule} Dengan ini saya menyatakan bahwa total pembelian valuta asing saya bulan ini belum melebihi USD 10.000 atau ekuivalennya.`;
}
