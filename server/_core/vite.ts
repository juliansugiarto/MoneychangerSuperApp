import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

// Vite dan vite.config (beserta plugin-pluginnya) hanya untuk mode pengembangan (`tsx watch`) dan bukan dependensi
// produksi. Keduanya dimuat di dalam setupVite: `import("vite")` tetap dinamis di bundel esbuild karena paketnya external,
// dan path config sengaja lewat variabel supaya esbuild tidak membundelnya (impor paket plugin akan terangkat ke atas
// bundel dan membuat `node dist/index.js` gagal di image produksi yang tidak memasang devDependencies).
const VITE_CONFIG_MODULE = "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const [{ createServer: createViteServer }, { default: viteConfig }] = await Promise.all([
    import("vite"),
    import(VITE_CONFIG_MODULE) as Promise<{ default: import("vite").UserConfig }>,
  ]);
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
