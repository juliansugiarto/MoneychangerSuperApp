import { describe, expect, it, vi } from "vitest";

/** Collects the `.name` of every drizzle Column object referenced directly in a SQL condition tree, without following a Column's own `.table` back-reference (which would pull in every unrelated column on that table and false-positive this check). */
function columnNamesUsedIn(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (!node || typeof node !== "object" || depth > 8 || seen.has(node)) return [];
  seen.add(node);
  const names: string[] = [];
  const record = node as Record<string, unknown>;
  if (typeof record.name === "string" && typeof record.columnType === "string") names.push(record.name);
  for (const [key, value] of Object.entries(record)) {
    if (key === "table") continue; // avoid pulling in the whole schema via a column's table back-reference
    if (Array.isArray(value)) for (const item of value) names.push(...columnNamesUsedIn(item, seen, depth + 1));
    else if (value && typeof value === "object") names.push(...columnNamesUsedIn(value, seen, depth + 1));
  }
  return names;
}
import { companyProfile, customers } from "../drizzle/schema";
import * as db from "./db";
import { getSipesatExport } from "./operations";

/** A thenable resolving to `rows` for any chain of select-builder calls, capturing the `where` condition passed to it. */
function chain(rows: unknown[], captureWhere?: (condition: unknown) => void) {
  const self = {
    from: () => self,
    where: (condition: unknown) => { captureWhere?.(condition); return self; },
    orderBy: () => self,
    limit: () => self,
    then: (onfulfilled: any, onrejected: any) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  return self;
}

const profile = { id: 1, sipesatIdPjk: "1000031" };

describe("getSipesatExport — quarterly scope per PER-02/1.02/PPATK/02/2014 Pasal 12b", () => {
  it("throws when the company profile has no SIPESAT ID PJK configured", async () => {
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue({ select: () => ({ from: (table: unknown) => chain(table === companyProfile ? [{ id: 1, sipesatIdPjk: null }] : []) }) } as never);
    await expect(getSipesatExport({ type: "INITIAL" })).rejects.toThrow(/ID PJK SIPESAT belum diisi/);
    getDb.mockRestore();
  });

  it("filters TRIWULAN customers by createdAt (newly added), not updatedAt (merely edited)", async () => {
    let capturedWhere: unknown;
    const inactiveButExisting = { id: 2, isDemo: false, isHistorical: false, profileStatus: "ACTIVE", fullName: "Budi", address: "Jl. A", identityType: "KTP", identityNumber: "123", cifNumber: "C1", placeOfBirth: null, dateOfBirth: null };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue({
      select: () => ({ from: (table: unknown) => table === companyProfile ? chain([profile]) : chain([inactiveButExisting], (condition) => { capturedWhere = condition; }) }),
    } as never);

    await getSipesatExport({ type: "TRIWULAN", triwulan: 2, tahun: 2026 });
    getDb.mockRestore();

    // The captured drizzle condition must reference createdAt, and must NOT filter on updatedAt —
    // regulation Pasal 12b asks for newly-added customers per quarter, not customers edited that quarter.
    const columnNames = columnNamesUsedIn(capturedWhere);
    expect(columnNames).toContain("createdAt");
    expect(columnNames).not.toContain("updatedAt");
  });

  it("INITIAL export includes customers regardless of profileStatus (closed/inactive customers are required too, per Pasal 13(2))", async () => {
    const closedCustomer = { id: 3, isDemo: false, isHistorical: false, profileStatus: "INACTIVE", fullName: "Closed Co", address: "Jl. B", identityType: "OTHER", identityNumber: "999", cifNumber: "C2", placeOfBirth: null, dateOfBirth: null };
    const getDb = vi.spyOn(db, "getDb").mockResolvedValue({
      select: () => ({ from: (table: unknown) => table === companyProfile ? chain([profile]) : chain([closedCustomer]) }),
    } as never);
    const result = await getSipesatExport({ type: "INITIAL" });
    getDb.mockRestore();
    expect(result.customerCount).toBe(1);
    expect(result.csv).toContain("Closed Co");
  });
});
