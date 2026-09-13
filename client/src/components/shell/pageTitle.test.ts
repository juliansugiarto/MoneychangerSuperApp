import { describe, expect, it } from "vitest";
import { backOfficeDestinations } from "@shared/backOfficeNavigation";
import { pageTitleFor } from "./pageTitle";

describe("pageTitleFor", () => {
  it("setiap tujuan sidebar punya judul dan kelompok dari pohon navigasi", () => {
    for (const destination of backOfficeDestinations) {
      expect(pageTitleFor(destination.path).title).toBe(destination.label);
    }
    expect(pageTitleFor("/kepatuhan/ira").group).toBe("Risiko");
  });

  it("rute di luar sidebar mendapat judul yang masuk akal", () => {
    expect(pageTitleFor("/operasional/pola")).toEqual({ group: "Pengaturan", title: "Galeri pola" });
    expect(pageTitleFor("/operasional/tidak-ada").title).toBe("Back office");
  });
});
