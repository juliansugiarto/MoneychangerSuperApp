import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

function renderSidebar(currentPath: string, open: boolean) {
  return render(
    <SidebarProvider defaultOpen={open}>
      <AppSidebar brand="Contoh Valuta" role="SHAREHOLDER" userName="Uji" roleLabel="Pemegang Saham" currentPath={currentPath} onNavigate={() => {}} onLogout={() => {}} />
    </SidebarProvider>,
  );
}

const buttonLabelled = (label: string) => screen.getAllByRole("button").find((button) => button.textContent?.trim() === label)!;

describe("AppSidebar", () => {
  it("induk yang memuat halaman aktif ditandai aktif, supaya rel ikon tetap menunjukkan posisi", () => {
    renderSidebar("/operasional/stock/kas-awal", false);
    expect(buttonLabelled("Uang Kas").getAttribute("data-active")).toBe("true");
    expect(buttonLabelled("Kurs").getAttribute("data-active")).toBe("false");
  });

  it("butir daun aktif memakai aria-current", () => {
    renderSidebar("/kepatuhan/ira", true);
    expect(buttonLabelled("Penilaian Risiko (IRA)").getAttribute("aria-current")).toBe("page");
  });
});
