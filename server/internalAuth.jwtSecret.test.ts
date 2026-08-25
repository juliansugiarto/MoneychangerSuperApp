import { describe, expect, it } from "vitest";
import { jwtVerify, SignJWT } from "jose";
import { ENV } from "./_core/env";
import { assertSessionSigningSecret, createInternalSession, verifyInternalSessionToken } from "./internalAuth";

describe("assertSessionSigningSecret", () => {
  it("menerima JWT_SECRET server-side yang memenuhi minimum panjang byte", () => {
    const secret = "A1b2C3d4E5f6G7h8I9j0K";
    expect(assertSessionSigningSecret(secret)).toBe(secret);
  });

  it("menolak JWT_SECRET kosong, terlalu pendek, atau mengandung spasi tepi", () => {
    expect(() => assertSessionSigningSecret("")).toThrow("JWT_SECRET belum dikonfigurasi");
    expect(() => assertSessionSigningSecret("terlalu-pendek")).toThrow("minimal 20 byte");
    expect(() => assertSessionSigningSecret(" secret-aman-yang-panjang-123 ")).toThrow("spasi di awal atau akhir");
  });

  it("menandatangani JWT sesi dengan JWT_SECRET, audience, dan subject internal", async () => {
    const originalSecret = ENV.cookieSecret;
    ENV.cookieSecret = "A1b2C3d4E5f6G7h8I9j0K";
    try {
      const token = await createInternalSession({ id: 81, sessionVersion: 3 });
      const configuredKey = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, configuredKey, {
        algorithms: ["HS256"],
        issuer: "ibukota-valasindo-internal",
        audience: "ibukota-valasindo-backoffice",
      });
      expect(payload.sub).toBe("81");
      expect(payload.userId).toBe(81);
      expect(payload.sessionVersion).toBe(3);
      await expect(jwtVerify(token, new TextEncoder().encode("Kunci-lain-yang-tidak-sama-123"))).rejects.toThrow();
    } finally {
      ENV.cookieSecret = originalSecret;
    }
  });

  it("menolak token dengan issuer, audience, atau subject yang tidak sesuai", async () => {
    const originalSecret = ENV.cookieSecret;
    ENV.cookieSecret = "A1b2C3d4E5f6G7h8I9j0K";
    try {
      const key = new TextEncoder().encode(ENV.cookieSecret);
      const createTokenWith = async (issuer: string, audience: string, subject: string) =>
        new SignJWT({ userId: 81, sessionVersion: 3 })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setIssuer(issuer)
          .setAudience(audience)
          .setSubject(subject)
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(key);

      await expect(verifyInternalSessionToken(await createTokenWith("issuer-lain", "ibukota-valasindo-backoffice", "81"))).resolves.toBeNull();
      await expect(verifyInternalSessionToken(await createTokenWith("ibukota-valasindo-internal", "audience-lain", "81"))).resolves.toBeNull();
      await expect(verifyInternalSessionToken(await createTokenWith("ibukota-valasindo-internal", "ibukota-valasindo-backoffice", "99"))).resolves.toBeNull();
    } finally {
      ENV.cookieSecret = originalSecret;
    }
  });
});
