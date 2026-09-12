import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_ACCENT } from "@shared/accentColor";
import { FOUNDATION_FILES } from "./designFoundation";

const root = process.cwd();
/** Warna mentah dalam bentuk apa pun. Berkas di atas fondasi hanya boleh memakai token. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/;

describe("penjaga fondasi desain", () => {
  it("setiap berkas yang terdaftar benar-benar ada", () => {
    expect(FOUNDATION_FILES.filter((file) => !existsSync(join(root, file)))).toEqual([]);
  });

  it("berkas di atas fondasi tidak menulis warna mentah", () => {
    const offenders = FOUNDATION_FILES.filter((file) => RAW_COLOR.test(readFileSync(join(root, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("aksen bawaan di CSS sama dengan PRODUCT_ACCENT", () => {
    const css = readFileSync(join(root, "client/src/index.css"), "utf8").toLowerCase();
    expect(css).toContain(`--brand: ${PRODUCT_ACCENT.toLowerCase()};`);
  });
});
