import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(new URL("../client/src/pages/OperationsDashboard.tsx", import.meta.url), "utf8");
const userManagementSource = readFileSync(new URL("../client/src/pages/UserManagement.tsx", import.meta.url), "utf8");

describe("Shareholder dashboard user management", () => {
  it("shows a dedicated Admin and Staff management section only to Shareholders", () => {
    expect(dashboardSource).toContain('const isShareholder = user?.role === "SHAREHOLDER"');
    expect(dashboardSource).toContain('{isShareholder ? <ShareholderUserManagement');
    expect(dashboardSource).toContain('aria-label="Manajemen pengguna"');
    expect(dashboardSource).toContain('Buat akun Admin');
    expect(dashboardSource).toContain('Buat akun Staff');
    expect(dashboardSource).toContain('Kelola seluruh akun');
  });

  it("opens the existing management flow with an Admin or Staff role preselected", () => {
    expect(dashboardSource).toContain('goTo("/operasional/pengguna?role=ADMIN")');
    expect(dashboardSource).toContain('goTo("/operasional/pengguna?role=STAFF")');
    expect(userManagementSource).toContain('const requestedRole = new URLSearchParams(window.location.search).get("role")');
    expect(userManagementSource).toContain('requestedRole === "ADMIN" || requestedRole === "STAFF"');
  });
});
