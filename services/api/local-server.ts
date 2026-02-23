import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type HandlerModule = {
  default: (req: any, res: any) => unknown | Promise<unknown>;
};

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  const candidates = [".env", ".env.local"];

  for (const file of candidates) {
    const fullPath = path.join(cwd, file);
    if (!existsSync(fullPath)) continue;

    const raw = readFileSync(fullPath, "utf-8");
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;

      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) continue;
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnvFiles();

const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const routeMap: Record<string, string> = {
  "GET /api/health-local": "./api/health-local.ts",
  "GET /api/health": "./api/health.ts",
  "GET /api/env-check": "./api/env-check.ts",
  "POST /api/compare-routes": "./api/compare-routes.ts",
  "POST /api/execute-transfer": "./api/execute-transfer.ts",
  "POST /api/generate-proof": "./api/generate-proof.ts",
  "GET /api/test-db": "./api/test-db.ts",
  "POST /api/anchors/sep1/discover": "./api/anchors/sep1/discover.ts",
  "POST /api/anchors/sep24/info": "./api/anchors/sep24/info.ts",
  "POST /api/anchors/sep6/info": "./api/anchors/sep6/info.ts",
  "GET /api/anchors/countries": "./api/anchors/countries.ts",
  "GET /api/anchors/catalog": "./api/anchors/catalog.ts",
  "POST /api/anchors/capabilities/resolve":
    "./api/anchors/capabilities/resolve.ts",
  "POST /api/anchors/capabilities/refresh":
    "./api/anchors/capabilities/refresh.ts",
  "POST /api/anchors/sep10/token": "./api/anchors/sep10/token.ts",
  "POST /api/anchors/directory/import": "./api/anchors/directory/import.ts",
  "GET /api/cron/anchors-sync": "./api/cron/anchors-sync.ts",
  "POST /api/cron/anchors-sync": "./api/cron/anchors-sync.ts",
};

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createVercelResponse(res: ServerResponse) {
  let statusCode = 200;
  setCorsHeaders(res);
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      res.statusCode = statusCode;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
      return this;
    },
    send(payload: unknown) {
      res.statusCode = statusCode;
      res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      return this;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
    },
  };
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const path = (req.url ?? "").split("?")[0];

  setCorsHeaders(res);
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const key = `${method} ${path}`;
  const modulePath = routeMap[key];

  if (!modulePath) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Not found", method, path }));
    return;
  }

  try {
    const mod = (await import(modulePath)) as HandlerModule;
    const body = await readJson(req);
    const vReq = {
      method,
      url: req.url,
      headers: req.headers,
      body,
      query: {},
    };
    const vRes = createVercelResponse(res);
    await mod.default(vReq, vRes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(`[api] local server running on http://localhost:${PORT}`);
});
