import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("menampilkan kelompok dan judul, dan tombol cari membuka palet", async () => {
    const onOpenSearch = vi.fn();
    render(<SidebarProvider><AppHeader group="Uang & Kurs" title="Kas Awal Hari Ini" onOpenSearch={onOpenSearch} /></SidebarProvider>);
    // Kepala shell bukan heading: h1 milik PageHeader halaman, supaya tiap halaman hanya punya satu h1.
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Kas Awal Hari Ini").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Uang & Kurs")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Cari halaman/ }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });
});
