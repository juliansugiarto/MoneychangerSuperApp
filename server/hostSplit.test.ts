import { describe, expect, it } from "vitest";
import { hostSplitFromEnv, hostSplitRedirect } from "./hostSplit";

const split = { publicHost: "ibukotavalasindo.online", backofficeHost: "backoffice.ibukotavalasindo.online" };

describe("dua alamat: publik untuk nasabah, back office untuk staf", () => {
  it("tanpa PUBLIC_HOST dan BACKOFFICE_HOST lengkap tidak ada pemisahan (pengembangan lokal)", () => {
    expect(hostSplitFromEnv({})).toBeNull();
    expect(hostSplitFromEnv({ PUBLIC_HOST: "a.test" })).toBeNull();
    expect(hostSplitFromEnv({ PUBLIC_HOST: " A.test ", BACKOFFICE_HOST: "b.test" })).toEqual({ publicHost: "a.test", backofficeHost: "b.test" });
  });

  it("alamat publik: halaman kurs dilayani, jalur staf pindah ke back office dengan jalur dan kueri yang sama", () => {
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/")).toBeNull();
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/login")).toBe("https://backoffice.ibukotavalasindo.online/login");
    expect(hostSplitRedirect(split, "IBUKOTAVALASINDO.ONLINE", "/operasional/kurs?x=1")).toBe("https://backoffice.ibukotavalasindo.online/operasional/kurs?x=1");
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/kepatuhan/laporan-dttot")).toBe("https://backoffice.ibukotavalasindo.online/kepatuhan/laporan-dttot");
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/siapkan")).toBe("https://backoffice.ibukotavalasindo.online/siapkan");
    // Bukan jalur staf meski berawalan mirip.
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/loginx")).toBeNull();
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/assets/index.js")).toBeNull();
  });

  it("back office: beranda ke login, jalur lain dilayani; /api tidak pernah dialihkan", () => {
    expect(hostSplitRedirect(split, "backoffice.ibukotavalasindo.online", "/")).toBe("/login");
    expect(hostSplitRedirect(split, "backoffice.ibukotavalasindo.online", "/operasional")).toBeNull();
    expect(hostSplitRedirect(split, "ibukotavalasindo.online", "/api/trpc/rates.activeRates")).toBeNull();
    expect(hostSplitRedirect(split, "backoffice.ibukotavalasindo.online", "/api/trpc/auth.me")).toBeNull();
  });
});
