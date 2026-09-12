import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  // tsconfig memakai "jsx": "preserve" untuk Vite; uji membutuhkan transform JSX otomatis.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Hanya uji komponen (.tsx) yang berjalan di jsdom; uji server dan shared tetap di node.
    environmentMatchGlobs: [["client/src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["client/src/test/setup.ts"],
    // `shared/` dan `client/src/` ikut disertakan dengan sengaja: uji yang ditulis di sana tetapi
    // tidak pernah dijalankan lebih buruk daripada tidak ada uji sama sekali — ia terlihat seperti
    // jaring pengaman padahal tidak menangkap apa pun.
    include: [
      "server/**/*.{test,spec}.ts",
      "shared/**/*.{test,spec}.ts",
      "client/src/**/*.{test,spec}.ts",
      "client/src/**/*.{test,spec}.tsx",
    ],
  },
});
