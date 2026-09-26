import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserDetail } from "./UserDetail";

const base = { id: 7, username: "budi.kasir", name: "Budi Kasir", role: "STAFF", accountStatus: "ACTIVE", mustChangePassword: false, lastSignedIn: null };
const handlers = () => ({ onRoleChange: vi.fn(), onSuspend: vi.fn(), onActivate: vi.fn(), onResetPassword: vi.fn() });

describe("detail akun", () => {
  it("akun tata kelola tidak dapat diubah dari layar ini", () => {
    render(<UserDetail account={{ ...base, role: "CONTROLLER" }} {...handlers()} />);
    expect(screen.getByText(/dilindungi/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nonaktifkan" })).toBeNull();
  });

  it("menonaktifkan meminta konfirmasi yang menyebut nama akunnya", async () => {
    const actions = handlers();
    render(<UserDetail account={base} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
    expect(screen.getByRole("heading", { name: "Nonaktifkan Budi Kasir?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ya, nonaktifkan" }));
    expect(actions.onSuspend).toHaveBeenCalledOnce();
  });
});
