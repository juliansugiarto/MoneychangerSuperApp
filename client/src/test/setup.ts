import { afterEach } from "vitest";

// Uji komponen berjalan di jsdom; uji server dan shared tetap di node. Pembersihan dan tiruan
// matchMedia hanya dimuat bila ada DOM, supaya ratusan berkas uji server tidak ikut memuatnya.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
