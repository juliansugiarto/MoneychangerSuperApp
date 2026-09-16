import { useEffect, useRef } from "react";

export type ShortcutAction = "openPalette" | "newTransaction";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.contentEditable === "true") return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

const DIALOG_SELECTOR = "[role=dialog],[role=alertdialog]";
const OPEN_DIALOG_SELECTOR = "[role=dialog][data-state=open],[role=alertdialog][data-state=open]";

/**
 * Dialog modal memakai fokus sebagai jebakan: menekan N di dalamnya akan berpindah ke Buat Transaksi
 * dan membuang isian yang belum disimpan. Dicek dua arah — target di dalam dialog, dan ada dialog
 * terbuka di mana pun (fokus bisa saja masih di body sesudah dialog dibuka lewat tombol).
 */
export function isInsideOpenDialog(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement && target.closest(DIALOG_SELECTOR)) return true;
  return typeof document !== "undefined" && document.querySelector(OPEN_DIALOG_SELECTOR) !== null;
}

/** ⌘K/Ctrl+K berlaku di mana pun; N dan / hanya di luar kolom isian dan di luar dialog modal, supaya tidak mencuri ketikan. */
export function shortcutFor(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">): ShortcutAction | null {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return "openPalette";
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return null;
  if (isInsideOpenDialog(event.target)) return null;
  if (event.key === "n" || event.key === "N") return "newTransaction";
  if (event.key === "/") return "openPalette";
  return null;
}

export function useShortcuts(handlers: Record<ShortcutAction, () => void>) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutFor(event);
      if (!action) return;
      event.preventDefault();
      latest.current[action]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
