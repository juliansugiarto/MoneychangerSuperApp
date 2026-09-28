import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { attemptedTransactions, iraClassificationReviews, operationalSettings, watchlistBlocks, watchlistBlockStatuses } from "../drizzle/schema";

describe("skema butir B", () => {
  it("watchlist_blocks memuat kolom keputusan dan pelaporan", () => {
    const columns = Object.keys(getTableColumns(watchlistBlocks));
    for (const name of ["customerId", "openedAt", "source", "screeningId", "matchKeys", "status", "resolvedByUserId", "resolvedAt", "resolutionNotes", "ltkmReference", "biCopySentAt", "revocationReference"]) {
      expect(columns).toContain(name);
    }
    expect(watchlistBlockStatuses).toEqual(["OPEN", "CONFIRMED", "FALSE_POSITIVE", "DICABUT"]);
  });
  it("attempted_transactions menyimpan ringkasan, bukan bon", () => {
    const columns = Object.keys(getTableColumns(attemptedTransactions));
    for (const name of ["blockId", "customerId", "representativeCustomerId", "blockedParty", "tellerUserId", "attemptedAt", "operation", "linesSummary", "totalIdr"]) {
      expect(columns).toContain(name);
    }
  });
  it("ira_classification_reviews menyimpan snapshot dan selang ada di operational_settings", () => {
    expect(Object.keys(getTableColumns(iraClassificationReviews))).toEqual(expect.arrayContaining(["reviewedAt", "reviewedByUserId", "notes", "snapshot", "classificationCount"]));
    expect(Object.keys(getTableColumns(operationalSettings))).toContain("iraClassificationReviewMonths");
  });
});
