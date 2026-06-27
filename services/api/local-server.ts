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
const ROUTE_EXT =
  process.env.LOCAL_SERVER_ROUTE_EXT?.trim() ||
  (import.meta.url.endsWith(".js") ? ".js" : ".ts");

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const routeMap: Record<string, string> = {
  "GET /api/health-local": `./api/health-local${ROUTE_EXT}`,
  "GET /api/health": `./api/health${ROUTE_EXT}`,
  "GET /api/env-check": `./api/env-check${ROUTE_EXT}`,
  "POST /api/compare-routes": `./api/compare-routes${ROUTE_EXT}`,
  "POST /api/execute-transfer": `./api/execute-transfer${ROUTE_EXT}`,
  "POST /api/generate-proof": `./api/generate-proof${ROUTE_EXT}`,
  "GET /api/test-db": `./api/test-db${ROUTE_EXT}`,
  "POST /api/anchors/diagnostics": `./api/anchors/diagnostics${ROUTE_EXT}`,
  "GET /api/anchors/ops": `./api/anchors/ops${ROUTE_EXT}`,
  "POST /api/anchors/ops": `./api/anchors/ops${ROUTE_EXT}`,
  "POST /api/anchors/sep24/callback": `./api/anchors/sep24/callback${ROUTE_EXT}`,
  "GET /api/anchors/sep24/callback": `./api/anchors/sep24/callback${ROUTE_EXT}`,
  "GET /api/anchors/countries": `./api/anchors/countries${ROUTE_EXT}`,
  "GET /api/anchors/catalog": `./api/anchors/catalog${ROUTE_EXT}`,
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
    const parsedUrl = new URL(req.url ?? "/", "http://localhost");
    const query: Record<string, string | string[]> = {};
    parsedUrl.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing === undefined) {
        query[key] = value;
        return;
      }
      query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    });
    const vReq = {
      method,
      url: req.url,
      headers: req.headers,
      body,
      query,
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
