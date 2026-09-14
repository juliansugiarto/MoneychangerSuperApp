import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isTypingTarget, shortcutFor, useShortcuts } from "./shortcuts";

const key = (init: Partial<KeyboardEvent> & { key: string }, target: EventTarget | null = document.body) =>
  ({ metaKey: false, ctrlKey: false, altKey: false, ...init, target }) as KeyboardEvent;

describe("shortcutFor", () => {
  it("⌘K dan Ctrl+K membuka palet, bahkan saat mengetik", () => {
    const input = document.createElement("input");
    expect(shortcutFor(key({ key: "k", metaKey: true }, input))).toBe("openPalette");
    expect(shortcutFor(key({ key: "K", ctrlKey: true }))).toBe("openPalette");
  });

  it("N membuat bon baru dan / membuka palet — kecuali saat mengetik", () => {
    expect(shortcutFor(key({ key: "n" }))).toBe("newTransaction");
    expect(shortcutFor(key({ key: "/" }))).toBe("openPalette");
    const textarea = document.createElement("textarea");
    expect(shortcutFor(key({ key: "n" }, textarea))).toBeNull();
    expect(shortcutFor(key({ key: "/" }, textarea))).toBeNull();
  });

  it("kombinasi dengan tombol pengubah lain tidak dicuri", () => {
    expect(shortcutFor(key({ key: "n", ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key({ key: "n", altKey: true }))).toBeNull();
  });

  it("isTypingTarget mengenali input, select, dan contenteditable", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.appendChild(editable);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    editable.remove();
  });
});

describe("useShortcuts", () => {
  it("memanggil penangan yang sesuai dari keydown di window", () => {
    const openPalette = vi.fn();
    const newTransaction = vi.fn();
    function Probe() { useShortcuts({ openPalette, newTransaction }); return null; }
    render(<Probe />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.keyDown(window, { key: "n" });
    expect(openPalette).toHaveBeenCalledOnce();
    expect(newTransaction).toHaveBeenCalledOnce();
  });
});
