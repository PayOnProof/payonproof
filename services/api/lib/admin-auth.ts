import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const COOKIE_NAME = "pop_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

interface AdminSessionPayload {
  sub: "admin";
  email: string;
  exp: number;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
}

function sessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.EXECUTION_STATE_SECRET?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET");
  }
  return secret;
}

function configuredAdminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function configuredPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH ?? "";
}

function safeEqualText(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function verifyScryptPassword(password: string, encoded: string): boolean {
  const parts = encoded.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyAdminCredentials(input: {
  email: string;
  password: string;
}): boolean {
  const email = input.email.trim().toLowerCase();
  const adminEmail = configuredAdminEmail();
  if (!adminEmail || !safeEqualText(email, adminEmail)) return false;

  const passwordHash = configuredPasswordHash();
  if (passwordHash) return verifyScryptPassword(input.password, passwordHash);

  const password = configuredPassword();
  if (!password) return false;
  return safeEqualText(input.password, password);
}

export function createAdminSessionToken(email: string): string {
  const payload: AdminSessionPayload = {
    sub: "admin",
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = base64Url(JSON.stringify(payload));
  const signature = base64Url(
    createHmac("sha256", sessionSecret()).update(body).digest()
  );
  return `${body}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string
): AdminSessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = base64Url(
    createHmac("sha256", sessionSecret()).update(body).digest()
  );
  if (!safeEqualText(signature, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(body).toString("utf-8")) as
      | AdminSessionPayload
      | undefined;
    if (!payload || payload.sub !== "admin") return null;
    if (payload.email !== configuredAdminEmail()) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getHeader(req: VercelRequest, key: string): string {
  const raw = req.headers[key.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function cookieToken(req: VercelRequest): string {
  const rawCookie = getHeader(req, "cookie");
  for (const part of rawCookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function getAdminSession(req: VercelRequest): AdminSessionPayload | null {
  const bearer = getHeader(req, "authorization").replace(/^Bearer\s+/i, "");
  const token = bearer || cookieToken(req);
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export function requireAdminSession(req: VercelRequest): AdminSessionPayload {
  const session = getAdminSession(req);
  if (!session) throw new Error("Unauthorized admin request");
  return session;
}

export function setAdminSessionCookie(
  res: VercelResponse,
  token: string
): void {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${SESSION_TTL_SECONDS}`,
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}

export function clearAdminSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
