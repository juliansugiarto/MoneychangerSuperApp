import { describe, expect, it, vi } from "vitest";
import { handleCreateFailure } from "./createFailure";

describe("bon yang ditolak server", () => {
  it("menampilkan pesannya dan memuat ulang harga papan, supaya kolom alasan selisih muncul tanpa menunggu jendela difokus ulang", () => {
    const notify = vi.fn();
    const invalidatePricing = vi.fn();
    handleCreateFailure(new Error("Harga USD 100 berselisih 1,29% dari kurs papan; isi alasan selisih."), { notify, invalidatePricing });
    expect(notify).toHaveBeenCalledWith("Harga USD 100 berselisih 1,29% dari kurs papan; isi alasan selisih.");
    expect(invalidatePricing).toHaveBeenCalledOnce();
  });
});
