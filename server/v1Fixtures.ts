/**
 * Isolated dummy records for V1 scenario tests. These constants are never inserted
 * into the application database and therefore require no production-data cleanup.
 */
export const v1Fixtures = {
  customer: {
    cifNumber: "TEST-CIF-0001",
    fullName: "Nasabah Uji V1",
    phoneNumber: "081234567890",
    identityType: "KTP" as const,
    identityNumber: "3174000000000001",
    identityExpiryDate: new Date("2031-12-31T00:00:00.000Z"),
    placeOfBirth: "Jakarta",
    dateOfBirth: new Date("1990-05-20T00:00:00.000Z"),
    address: "Jl. Pengujian V1 Nomor 1, Jakarta",
    occupation: "Karyawan swasta",
    sourceOfFunds: "Penghasilan bulanan",
    transactionPurpose: "Perjalanan bisnis",
    riskLevel: "LOW" as const,
    riskNotes: "Fixture pengujian; tidak disimpan ke database.",
  },
  normalUsdBuy: {
    operation: "BUY" as const,
    foreignAmount: "250.000000",
    rate: "16000.000000",
    quoteUnit: "1.000000",
    currentCashBalance: "1000.000000",
  },
  flaggedJpySell: {
    operation: "SELL" as const,
    foreignAmount: "200000.000000",
    rate: "11272.750000",
    quoteUnit: "100.000000",
    currentCashBalance: "300000.000000",
    riskLevel: "HIGH" as const,
  },
} as const;
