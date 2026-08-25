import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateConsumerComplaint: vi.fn(),
}));

vi.mock("./operations", async () => {
  const actual = await vi.importActual<typeof import("./operations")>("./operations");
  return { ...actual, updateConsumerComplaint: mocks.updateConsumerComplaint };
});

const { appRouter } = await import("./routers");

type InternalRole = "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER";

function createCaller(role: InternalRole) {
  return appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    user: { id: 77, role, mustChangePassword: false } as never,
  });
}

describe("complaint update authorization", () => {
  const input = {
    complaintId: 18,
    status: "RESOLVED" as const,
    resolution: "Hasil penanganan dan konfirmasi kepada pelapor telah dicatat.",
  };

  beforeEach(() => {
    mocks.updateConsumerComplaint.mockReset();
    mocks.updateConsumerComplaint.mockResolvedValue({ id: input.complaintId, status: input.status });
  });

  it("rejects a STAFF attempt to resolve a consumer complaint before the service is called", async () => {
    await expect(createCaller("STAFF").complaints.update(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateConsumerComplaint).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "CONTROLLER", "SHAREHOLDER"] as const)("allows %s to resolve a consumer complaint", async (role) => {
    await expect(createCaller(role).complaints.update(input)).resolves.toEqual({ id: input.complaintId, status: input.status });
    expect(mocks.updateConsumerComplaint).toHaveBeenCalledWith(input, 77);
  });
});
