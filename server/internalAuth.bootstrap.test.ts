import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createInternalUser: vi.fn(),
  getInternalUserById: vi.fn(),
  getInternalUserByUsername: vi.fn(),
  hasShareholder: vi.fn(),
  touchLastSignedIn: vi.fn(),
  updateInternalUserPassword: vi.fn(),
}));

vi.mock("./db", () => db);

const { ENV } = await import("./_core/env");
const { ensureInitialShareholder, verifyInternalCredentials } = await import("./internalAuth");

const original = {
  username: ENV.initialShareholderUsername,
  password: ENV.initialShareholderPassword,
};

let storedUser: Record<string, unknown> | null = null;

beforeEach(() => {
  storedUser = null;
  ENV.initialShareholderUsername = "bootstrap-shareholder";
  ENV.initialShareholderPassword = "Bootstrap#2026!";
  db.createInternalUser.mockImplementation(async (input: Record<string, unknown>) => {
    storedUser = {
      id: 901,
      ...input,
      accountStatus: "ACTIVE",
      loginMethod: "INTERNAL",
      sessionVersion: 1,
    };
    return storedUser;
  });
  db.getInternalUserByUsername.mockImplementation(async () => storedUser);
  db.getInternalUserById.mockResolvedValue(null);
  db.hasShareholder.mockResolvedValue(false);
  db.touchLastSignedIn.mockResolvedValue(undefined);
  db.updateInternalUserPassword.mockResolvedValue(undefined);
});

afterEach(() => {
  ENV.initialShareholderUsername = original.username;
  ENV.initialShareholderPassword = original.password;
  vi.clearAllMocks();
});

describe("bootstrap Shareholder internal", () => {
  it("membuat akun Shareholder baru dari kredensial bootstrap dan dapat memverifikasinya", async () => {
    await expect(ensureInitialShareholder()).resolves.toBe(true);
    expect(db.createInternalUser).toHaveBeenCalledWith(expect.objectContaining({
      username: "bootstrap-shareholder",
      name: "Initial Shareholder",
      role: "SHAREHOLDER",
      mustChangePassword: true,
    }));
    const createdInput = db.createInternalUser.mock.calls[0][0] as { passwordHash: string };
    expect(createdInput.passwordHash).not.toContain("Bootstrap#2026!");

    await expect(verifyInternalCredentials("bootstrap-shareholder", "Bootstrap#2026!")).resolves.toMatchObject({
      role: "SHAREHOLDER",
      username: "bootstrap-shareholder",
    });
    expect(db.touchLastSignedIn).toHaveBeenCalledWith(901);
  });

  it("tidak membuat atau mereset Shareholder ketika akun sudah ada", async () => {
    db.hasShareholder.mockResolvedValue(true);

    await expect(ensureInitialShareholder()).resolves.toBe(false);
    expect(db.createInternalUser).not.toHaveBeenCalled();
    expect(db.updateInternalUserPassword).not.toHaveBeenCalled();
  });
});
