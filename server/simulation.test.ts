import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { getTransactionReport, listTransactions } from "./operations";
import { appRouter } from "./routers";
import { simulateArchiveReadiness, simulateClosing, simulateExchange, simulateRateShock } from "./simulation";
import { printBon } from "../client/src/pages/Transactions";

describe("safe training simulation", () => {
  it("calculates a training exchange without assigning a live transaction number", () => {
    expect(simulateExchange({ foreignAmount: "100", rate: "17700", quoteUnit: "1" })).toEqual({ foreignAmount: "100.000000", rate: "17700.000000", quoteUnit: "1.000000", rupiahAmount: "1770000.00", isSimulation: true });
  });

  it("shows a training closing variance without touching cash records", () => {
    expect(simulateClosing({ systemBalance: "500", physicalBalance: "495.5" })).toEqual({ systemBalance: "500.000000", physicalBalance: "495.500000", variance: "-4.500000", reconciliationStatus: "PERLU_DITINJAU", isSimulation: true });
  });

  it("flags a training rate shock without creating an outlet-rate proposal", () => {
    expect(simulateRateShock({ referenceRate: "17700", proposedRate: "18600", reviewThresholdPercent: "3" })).toEqual({ referenceRate: "17700.000000", proposedRate: "18600.000000", reviewThresholdPercent: "3.00", differencePercent: "5.08", reviewRequired: true, recommendation: "PERLU_REVIEW_MANUSIA", isSimulation: true });
  });

  it("checks archive prerequisites as a training-only result", () => {
    expect(simulateArchiveReadiness({ closingChecklistComplete: true, stockOpnameReconciled: false })).toEqual({ closingChecklistComplete: true, stockOpnameReconciled: false, readyToArchive: false, missing: ["Stock opname / rekonsiliasi latihan"], isSimulation: true });
  });

  it("does not access the database or return a production identifier through the staff simulation route", async () => {
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 7, role: "STAFF", mustChangePassword: false } as never });
    const [result, rateShock, archive] = await Promise.all([
      caller.simulation.exchange({ foreignAmount: "100", rate: "17700", quoteUnit: "1" }),
      caller.simulation.rateShock({ referenceRate: "17700", proposedRate: "18100", reviewThresholdPercent: "2" }),
      caller.simulation.archiveReadiness({ closingChecklistComplete: true, stockOpnameReconciled: true }),
    ]);
    expect(result).toMatchObject({ rupiahAmount: "1770000.00", isSimulation: true });
    expect(rateShock).toMatchObject({ reviewRequired: true, isSimulation: true });
    expect(archive).toMatchObject({ readyToArchive: true, isSimulation: true });
    expect(result).not.toHaveProperty("transactionNumber");
    expect(result).not.toHaveProperty("id");
    expect(getDb).not.toHaveBeenCalled();
    getDb.mockRestore();
  });

  it("leaves production receipt lists and reports unchanged after a simulation", async () => {
    const liveRows = [{ transaction: { id: 91, transactionNumber: "LIVE-001", isDemo: false, isHistorical: false }, customer: { id: 12, isDemo: false, isHistorical: false }, currency: { code: "USD" } }];
    const reader = {
      from: () => reader,
      innerJoin: () => reader,
      where: () => reader,
      orderBy: () => Promise.resolve(liveRows),
    };
    const fakeDb = { select: vi.fn(() => reader) };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(fakeDb as never);
    const caller = appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 7, role: "STAFF", mustChangePassword: false } as never });

    const simulation = await caller.simulation.exchange({ foreignAmount: "100", rate: "17700", quoteUnit: "1" });
    const [listed, reported] = await Promise.all([
      listTransactions({ id: 7, role: "STAFF" }),
      getTransactionReport({ from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-31T00:00:00.000Z") }),
    ]);

    expect(simulation).toMatchObject({ isSimulation: true });
    expect(listed.map(({ transaction }) => transaction.transactionNumber)).toEqual(["LIVE-001"]);
    expect(reported.map(({ transaction }) => transaction.transactionNumber)).toEqual(["LIVE-001"]);
    expect(JSON.stringify([...listed, ...reported])).not.toContain('"isSimulation":true');
    expect(liveRows).toHaveLength(1);
    getDb.mockRestore();
  });

  it("keeps the printable production archive free of the simulation result", async () => {
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue(null);
    const caller = appRouter.createCaller({ req: { headers: {} } as never, res: {} as never, user: { id: 7, role: "STAFF", mustChangePassword: false } as never });
    const simulation = await caller.simulation.exchange({ foreignAmount: "100", rate: "17700", quoteUnit: "1" });
    let printedHtml = "";
    vi.stubGlobal("window", { open: vi.fn(() => ({ document: { write: (html: string) => { printedHtml = html; }, close: vi.fn() } })) });

    printBon({ transactionNumber: "LIVE-ARCHIVE-001", operation: "BUY", transactionAt: new Date("2026-08-24T08:00:00.000Z"), foreignAmount: "10", rateSnapshot: "15000", quoteUnitSnapshot: "1", rupiahAmount: "150000", paymentMethod: "CASH", paymentReference: "Kas", transactionPurposeSnapshot: "Perjalanan", customerActingAs: "SELF" }, { id: 12, fullName: "Nasabah Produksi", cifNumber: "CIF-001", identityType: "KTP", identityNumber: "3203", transactionPurpose: "Perjalanan" }, "USD");

    expect(printedHtml).toContain("LIVE-ARCHIVE-001");
    expect(printedHtml).toContain("Rp 150.000,00");
    expect(printedHtml).not.toContain(simulation.rupiahAmount);
    expect(printedHtml).not.toContain("isSimulation");
    expect(getDb).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    getDb.mockRestore();
  });
});
