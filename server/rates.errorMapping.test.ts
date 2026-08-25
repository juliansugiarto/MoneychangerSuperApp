import { describe, expect, it } from "vitest";
import { operationalActionError } from "../client/src/lib/rateActionError";

describe("operationalActionError", () => {
  it.each(["fetch failed", "network timeout", "getaddrinfo ENOTFOUND", "DATABASE_UNAVAILABLE"]) (
    "maps %s to an actionable operator message",
    (message) => {
      expect(operationalActionError({ message })).toBe(
        "Koneksi layanan sementara tidak tersedia. Tidak ada perubahan kurs yang dicatat; coba lagi beberapa saat.",
      );
    },
  );

  it("keeps a specific business error visible to the operator", () => {
    expect(operationalActionError({ message: "Snapshot BI belum tersedia." })).toBe("Snapshot BI belum tersedia.");
  });
});
