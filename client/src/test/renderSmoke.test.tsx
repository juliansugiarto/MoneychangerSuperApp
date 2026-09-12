import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("lingkungan uji komponen", () => {
  it("merender komponen React di jsdom", () => {
    render(<Button>Simpan</Button>);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
  });

  it("menyediakan matchMedia untuk komponen yang membaca ukuran layar", () => {
    expect(window.matchMedia("(max-width: 767px)").matches).toBe(false);
  });
});
