import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createInternalUser: vi.fn(),
  getInternalUserById: vi.fn(),
  listInternalUsers: vi.fn(),
  updateInternalUserPassword: vi.fn(),
  updateInternalUserRole: vi.fn(),
  updateInternalUserStatus: vi.fn(),
}));

import { createInternalUser, getInternalUserById, updateInternalUserRole } from "./db";
import { appRouter } from "./routers";

const workforceAccount = {
  id: 42,
  username: "operational-admin",
  name: "Operational Admin",
  email: null,
  role: "ADMIN" as const,
  accountStatus: "ACTIVE" as const,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: null,
};

function createCaller(role: "STAFF" | "ADMIN" | "CONTROLLER" | "SHAREHOLDER") {
  return appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    user: { id: 7, role, mustChangePassword: false } as never,
  });
}

describe("delegated workforce role administration", () => {
  beforeEach(() => {
    vi.mocked(createInternalUser).mockReset();
    vi.mocked(getInternalUserById).mockReset();
    vi.mocked(updateInternalUserRole).mockReset();
  });

  it("rejects role changes from Staff and Admin", async () => {
    await expect(createCaller("STAFF").users.setRole({ userId: 42, role: "STAFF" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCaller("ADMIN").users.setRole({ userId: 42, role: "STAFF" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows Controller to change a workforce account only", async () => {
    vi.mocked(getInternalUserById).mockResolvedValue(workforceAccount as never);
    vi.mocked(updateInternalUserRole).mockResolvedValue({ ...workforceAccount, role: "STAFF" } as never);

    await expect(createCaller("CONTROLLER").users.setRole({ userId: 42, role: "STAFF" })).resolves.toMatchObject({
      id: 42,
      role: "STAFF",
    });
    expect(updateInternalUserRole).toHaveBeenCalledWith(42, "STAFF");
  });

  it("rejects an attempt to delegate a Controller or Shareholder account", async () => {
    vi.mocked(getInternalUserById).mockResolvedValue({ ...workforceAccount, role: "CONTROLLER" } as never);

    await expect(createCaller("SHAREHOLDER").users.setRole({ userId: 42, role: "ADMIN" })).rejects.toThrow(
      "Hanya akun Admin atau Staff",
    );
    expect(updateInternalUserRole).not.toHaveBeenCalled();
  });

  it("allows only Shareholder to provision a Controller", async () => {
    await expect(createCaller("CONTROLLER").users.create({ username: "controller.baru", name: "Controller Baru", password: "kata-sandi-minimal", role: "CONTROLLER" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createInternalUser).not.toHaveBeenCalled();

    vi.mocked(createInternalUser).mockResolvedValue({ ...workforceAccount, username: "controller.baru", name: "Controller Baru", role: "CONTROLLER" } as never);
    await expect(createCaller("SHAREHOLDER").users.create({ username: "controller.baru", name: "Controller Baru", password: "kata-sandi-minimal", role: "CONTROLLER" })).resolves.toMatchObject({ role: "CONTROLLER" });
  });
});
