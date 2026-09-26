import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { PublicFaqItem } from "@shared/publicPage";
import { FaqEditor } from "./FaqEditor";

function Harness({ initial }: { initial: PublicFaqItem[] }) {
  const [items, setItems] = useState(initial);
  return <FaqEditor items={items} onChange={setItems} />;
}

describe("penyunting FAQ", () => {
  it("menambah pasangan tanya-jawab kosong", async () => {
    render(<Harness initial={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Tambah pertanyaan" }));
    expect(screen.getByLabelText("Pertanyaan 1")).toBeTruthy();
    expect(screen.getByLabelText("Jawaban 1")).toBeTruthy();
  });

  it("berhenti menambah pada 12 pertanyaan", () => {
    render(<Harness initial={Array.from({ length: 12 }, (_, index) => ({ question: `Q${index}`, answer: "A" }))} />);
    expect(screen.getByRole("button", { name: "Tambah pertanyaan" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Batas 12 pertanyaan/)).toBeTruthy();
  });

  it("menurunkan pertanyaan menukar urutannya", async () => {
    render(<Harness initial={[{ question: "Satu", answer: "A" }, { question: "Dua", answer: "B" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Turunkan pertanyaan 1" }));
    expect((screen.getByLabelText("Pertanyaan 1") as HTMLInputElement).value).toBe("Dua");
  });
});
