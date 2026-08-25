import { describe, expect, it } from "vitest";
import { assertServiceRequestStatusTransition } from "./operations";

describe("service request lifecycle", () => {
  it("allows the controlled operational progression", () => {
    expect(() => assertServiceRequestStatusTransition("BARU", "MENUNGGU_VERIFIKASI")).not.toThrow();
    expect(() => assertServiceRequestStatusTransition("MENUNGGU_VERIFIKASI", "KURS_DIKONFIRMASI")).not.toThrow();
    expect(() => assertServiceRequestStatusTransition("KURS_DIKONFIRMASI", "SIAP_DILAYANI")).not.toThrow();
    expect(() => assertServiceRequestStatusTransition("SIAP_DILAYANI", "KEDALUWARSA")).not.toThrow();
  });

  it("rejects skipped and terminal-state changes", () => {
    expect(() => assertServiceRequestStatusTransition("BARU", "SIAP_DILAYANI")).toThrow("tidak diizinkan");
    expect(() => assertServiceRequestStatusTransition("KURS_DIKONFIRMASI", "MENUNGGU_VERIFIKASI")).toThrow("tidak diizinkan");
    expect(() => assertServiceRequestStatusTransition("KEDALUWARSA", "SIAP_DILAYANI")).toThrow("sudah berakhir");
    expect(() => assertServiceRequestStatusTransition("DIBATALKAN", "MENUNGGU_VERIFIKASI")).toThrow("sudah berakhir");
  });
});
