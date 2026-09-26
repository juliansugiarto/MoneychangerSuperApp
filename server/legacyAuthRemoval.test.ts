import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("bootstrap .env dan OAuth Manus sudah dibuang", () => {
  it("tidak ada simbol sisa di kode server, shared, maupun klien", () => {
    const files = ["server/internalAuth.ts", "server/_core/index.ts", "server/_core/env.ts", "server/db.ts", "shared/const.ts", "client/src/main.tsx"];
    const forbidden = ["ensureInitialShareholder", "INITIAL_SHAREHOLDER", "initialShareholder", "OWNER_OPEN_ID", "ownerOpenId", "VITE_APP_ID", "upsertUser", "getUserByOpenId", "OAUTH_STATE_COOKIE", "encodeOAuthState", "manus-cookie", "startLogin"];
    for (const file of files) {
      const source = read(file);
      for (const symbol of forbidden) expect(source, `${symbol} masih ada di ${file}`).not.toContain(symbol);
    }
    expect(existsSync(new URL("../client/src/const.ts", import.meta.url))).toBe(false);
  });

  it(".env.example tidak lagi meminta kata sandi pemilik", () => {
    const example = read(".env.example");
    expect(example).not.toContain("INITIAL_SHAREHOLDER");
    expect(example).toContain("tenant.mjs setup-code");
  });
});
