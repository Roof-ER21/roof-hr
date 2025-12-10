import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
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
  // In production, try multiple paths to find the build output
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"),           // /app/dist/public when running from dist/index.js
    path.resolve(process.cwd(), "dist", "public"),         // /app/dist/public using cwd
    path.resolve(import.meta.dirname, "..", "dist", "public"), // fallback
  ];

  let servePath = "";
  for (const p of possiblePaths) {
    console.log(`[Static] Checking path: ${p}, exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      servePath = p;
      break;
    }
  }

  if (!servePath) {
    throw new Error(
      `Could not find the build directory. Checked: ${possiblePaths.join(", ")}`,
    );
  }

  // Log what files are in the directory
  try {
    const files = fs.readdirSync(servePath);
    console.log(`[Static] Serving from: ${servePath}`);
    console.log(`[Static] Files in directory: ${files.join(", ")}`);
  } catch (e) {
    console.error(`[Static] Error reading directory:`, e);
  }

  app.use(express.static(servePath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(servePath, "index.html"));
  });
}
