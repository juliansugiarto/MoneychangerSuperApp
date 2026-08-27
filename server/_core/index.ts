import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ensureDevelopmentTestAccounts, ensureInitialShareholder } from "../internalAuth";
import { authenticateInternalRequest } from "../internalAuth";
import { decodeOperationalDocumentData, getOperationalDocumentDownloadUrl, uploadOperationalDocument } from "../documentOperations";
import { importFinancialSnapshotBundle, importFinancialSnapshotFile } from "../financialImport";
import { createFinancialWorkbookTemplate } from "../financialTemplate";
import { appRouter } from "../routers";
import { handleScheduledBiRateSync } from "../biRateSync";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  if (await ensureInitialShareholder()) console.log("[Auth] Initial Shareholder account provisioned.");
  if (await ensureDevelopmentTestAccounts()) console.log("[Auth] Development-only test accounts provisioned.");
  app.post("/api/scheduled/bi-rate-sync", handleScheduledBiRateSync);
  app.post("/api/operational-documents", async (req, res) => {
    try {
      const user = await authenticateInternalRequest(req);
      if (user.mustChangePassword) return res.status(403).json({ message: "Ganti kata sandi terlebih dahulu sebelum mengunggah dokumen." });
      const data = decodeOperationalDocumentData(String(req.body?.dataBase64 ?? ""));
      const document = await uploadOperationalDocument({
        documentType: req.body?.documentType,
        customerId: req.body?.customerId ? Number(req.body.customerId) : undefined,
        transactionId: req.body?.transactionId ? Number(req.body.transactionId) : undefined,
        originalFileName: String(req.body?.originalFileName ?? ""),
        mimeType: String(req.body?.mimeType ?? ""),
        byteSize: Number(req.body?.byteSize),
        data,
        documentReference: typeof req.body?.documentReference === "string" ? req.body.documentReference : undefined,
        notes: typeof req.body?.notes === "string" ? req.body.notes : undefined,
      }, user.id);
      return res.status(201).json({ document });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Dokumen tidak dapat diunggah." });
    }
  });
  app.post("/api/financial-snapshot-import", async (req, res) => {
    try {
      const user = await authenticateInternalRequest(req);
      if (user.mustChangePassword) return res.status(403).json({ message: "Ganti kata sandi terlebih dahulu sebelum mengimpor snapshot keuangan." });
      if (user.role !== "CONTROLLER" && user.role !== "SHAREHOLDER") return res.status(403).json({ message: "Hanya Controller atau Shareholder yang dapat mengimpor snapshot keuangan." });
      const imported = await importFinancialSnapshotFile({ dataBase64: String(req.body?.dataBase64 ?? ""), originalFileName: String(req.body?.originalFileName ?? ""), mimeType: String(req.body?.mimeType ?? ""), byteSize: Number(req.body?.byteSize), actorUserId: user.id });
      return res.status(201).json({ imported });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Berkas snapshot keuangan tidak dapat diimpor." });
    }
  });
  app.post("/api/financial-snapshot-bundle-import", async (req, res) => {
    try {
      const user = await authenticateInternalRequest(req);
      if (user.mustChangePassword) return res.status(403).json({ message: "Ganti kata sandi terlebih dahulu sebelum mengimpor snapshot keuangan." });
      if (user.role !== "CONTROLLER" && user.role !== "SHAREHOLDER") return res.status(403).json({ message: "Hanya Controller atau Shareholder yang dapat mengimpor snapshot keuangan." });
      if (!Array.isArray(req.body?.files)) return res.status(400).json({ message: "Tiga workbook sumber wajib dipilih." });
      const imported = await importFinancialSnapshotBundle({ files: req.body.files.map((file: unknown) => { const value = file as Record<string, unknown>; return { dataBase64: String(value.dataBase64 ?? ""), originalFileName: String(value.originalFileName ?? ""), mimeType: String(value.mimeType ?? ""), byteSize: Number(value.byteSize) }; }), actorUserId: user.id });
      return res.status(201).json({ imported });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Tiga workbook snapshot keuangan tidak dapat diimpor." });
    }
  });
  app.get("/api/financial-snapshot-template", async (req, res) => {
    try {
      const user = await authenticateInternalRequest(req);
      if (user.mustChangePassword) return res.status(403).send("Ganti kata sandi terlebih dahulu sebelum mengunduh template.");
      if (user.role !== "CONTROLLER" && user.role !== "SHAREHOLDER") return res.status(403).send("Hanya Controller atau Shareholder yang dapat mengunduh template.");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=template-laporan-keuangan-B0002-B0003-B0004.xlsx");
      return res.status(200).send(createFinancialWorkbookTemplate());
    } catch {
      return res.status(401).send("Autentikasi diperlukan untuk mengunduh template.");
    }
  });
  app.get("/api/operational-documents/:documentId/download", async (req, res) => {
    try {
      const user = await authenticateInternalRequest(req);
      if (user.mustChangePassword) return res.status(403).json({ message: "Ganti kata sandi terlebih dahulu sebelum membuka dokumen." });
      const url = await getOperationalDocumentDownloadUrl(Number(req.params.documentId));
      return res.redirect(url);
    } catch (error) {
      return res.status(404).json({ message: "Dokumen tidak tersedia." });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
