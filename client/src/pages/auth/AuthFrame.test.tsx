import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthFrame } from "./AuthFrame";

describe("bingkai layar tanpa akun", () => {
  it("selama nama usaha belum diketahui, tidak ada nama maupun inisial yang tampil — tidak berkedip ke nama produk", () => {
    const { container } = render(<AuthFrame brand={null} logoUrl={null} title="Masuk"><p>isi</p></AuthFrame>);
    expect(container.textContent).not.toContain("Aplikasi Valuta");
    expect(container.querySelector("[data-brand-placeholder]")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Masuk" })).toBeTruthy();
  });

  it("nama usaha yang sudah diketahui tampil beserta inisialnya", () => {
    render(<AuthFrame brand="ABC Valas" logoUrl={null} title="Masuk"><p>isi</p></AuthFrame>);
    expect(screen.getByText("ABC Valas")).toBeTruthy();
    expect(screen.getByText("AV")).toBeTruthy();
  });
});
