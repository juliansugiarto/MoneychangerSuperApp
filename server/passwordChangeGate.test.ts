import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("penghalang perubahan kata sandi awal", () => {
  it("menolak prosedur operasional untuk akun yang wajib mengganti kata sandi", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      user: { id: 777, role: "STAFF", mustChangePassword: true } as never,
    });

    await expect(caller.customers.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Anda wajib mengganti kata sandi awal sebelum menggunakan fitur operasional.",
    });
  });
});
