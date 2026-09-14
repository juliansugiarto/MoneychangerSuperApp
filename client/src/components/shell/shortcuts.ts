import { useEffect, useRef } from "react";

export type ShortcutAction = "openPalette" | "newTransaction";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.contentEditable === "true") return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** ⌘K/Ctrl+K berlaku di mana pun; N dan / hanya di luar kolom isian, supaya tidak mencuri ketikan. */
export function shortcutFor(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">): ShortcutAction | null {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return "openPalette";
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return null;
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
