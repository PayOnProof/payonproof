import { apiUrl } from "./api";
import type { AnchorCountry, ProofOfPayment, RemittanceRoute } from "./types";

async function readApiPayload<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const raw = await response.text();
  if (!raw) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    const looksLikeHtml = raw.trimStart().startsWith("<");
    if (looksLikeHtml || contentType.includes("text/html")) {
      throw new Error(
        `API ${endpoint} returned HTML instead of JSON. Check NEXT_PUBLIC_API_BASE_URL in Vercel.`
      );
    }
    throw new Error(
      `API ${endpoint} returned non-JSON response (${response.status}).`
    );
  }
}

export async function fetchAnchorCountries(): Promise<AnchorCountry[]> {
  const endpoint = apiUrl("/api/anchors/countries");
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = await readApiPayload<{
    countries?: AnchorCountry[];
    error?: string;
  }>(response, endpoint);

  if (!response.ok) {
    throw new Error(payload.error || "Failed to fetch anchor countries");
  }

  return payload.countries ?? [];
}

export async function compareRoutes(params: {
  origin: string;
  destination: string;
  amount: number;
}): Promise<{ routes: RemittanceRoute[]; noRouteReason?: string }> {
  const endpoint = apiUrl("/api/compare-routes");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = await readApiPayload<{
    routes?: RemittanceRoute[];
    meta?: { noRouteReason?: string };
    error?: string;
  }>(response, endpoint);

  if (!response.ok) {
    throw new Error(payload.error || "Failed to compare routes");
  }

  return {
    routes: payload.routes ?? [],
    noRouteReason: payload.meta?.noRouteReason,
  };
}

export interface PreparedTransfer {
  transactionId: string;
  routeId: string;
  senderAccount: string;
  amount: number;
  createdAt: string;
  anchors: Array<{
    role: "origin" | "destination";
    anchorId: string;
    anchorName: string;
    domain: string;
    assetCode: string;
    amount: number;
    account: string;
    webAuthEndpoint: string;
    transferServerSep24: string;
    challengeXdr: string;
    networkPassphrase: string;
  }>;
}

export async function prepareTransfer(params: {
  route: RemittanceRoute;
  amount: number;
  senderAccount: string;
}): Promise<PreparedTransfer> {
  const endpoint = apiUrl("/api/execute-transfer");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "prepare",
      route: params.route,
      amount: params.amount,
      senderAccount: params.senderAccount,
    }),
  });

  const payload = await readApiPayload<{
    status?: string;
    prepared?: PreparedTransfer;
    error?: string;
  }>(response, endpoint);

  if (!response.ok || payload.status !== "needs_signature" || !payload.prepared) {
    throw new Error(payload.error || "Failed to prepare transfer");
  }

  return payload.prepared;
}

export async function authorizeTransfer(params: {
  prepared: PreparedTransfer;
  signatures: Record<"origin" | "destination", string>;
}): Promise<{
    transaction: {
      id: string;
      routeId: string;
      amount: number;
      status: "processing";
      createdAt: string;
      senderAccount?: string;
      statusRef?: string;
      callbackUrl?: string;
      popEnv?: "production" | "staging";
      anchorFlows?: {
        originDeposit?: {
          id?: string;
          url: string;
          type?: string;
          anchorName?: string;
        };
        destinationWithdraw?: {
          id?: string;
          url: string;
          type?: string;
          anchorName?: string;
        };
      };
    };
}> {
  const endpoint = apiUrl("/api/execute-transfer");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "authorize",
      prepared: params.prepared,
      signatures: params.signatures,
    }),
  });

  const payload = await readApiPayload<{
    status?: string;
    transaction?: {
      id: string;
      routeId: string;
      amount: number;
      status: "processing";
      createdAt: string;
      senderAccount?: string;
      anchorFlows?: {
        originDeposit?: {
          id?: string;
          url: string;
          type?: string;
          anchorName?: string;
        };
        destinationWithdraw?: {
          id?: string;
          url: string;
          type?: string;
          anchorName?: string;
        };
      };
    };
    error?: string;
  }>(response, endpoint);

  if (!response.ok || payload.status !== "processing" || !payload.transaction) {
    throw new Error(payload.error || "Failed to authorize transfer");
  }

  return { transaction: payload.transaction };
}

export async function verifyProof(params: {
  transactionId: string;
  stellarTxHash: string;
  route: string;
  originAmount: number;
  originCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  exchangeRate: number;
  totalFees: number;
}): Promise<ProofOfPayment> {
  const endpoint = apiUrl("/api/generate-proof");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = await readApiPayload<{
    proof?: ProofOfPayment;
    error?: string;
  }>(response, endpoint);

  if (!response.ok || !payload.proof) {
    throw new Error(payload.error || "Failed to verify proof");
  }

  return payload.proof;
}

export async function pollTransferStatus(params: {
  transactionId: string;
  statusRef: string;
}): Promise<{
  status: "ok";
  transactionId: string;
  stellarTxHash?: string;
  completed: boolean;
  anchors: Array<{
    role: "origin" | "destination";
    anchorName: string;
    interactiveId: string;
    ok: boolean;
    status?: string;
    stellarTxHash?: string;
    externalTransactionId?: string;
    error?: string;
  }>;
}> {
  const endpoint = apiUrl("/api/execute-transfer");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "status",
      transactionId: params.transactionId,
      statusRef: params.statusRef,
    }),
  });

  const payload = await readApiPayload<{
    status?: "ok";
    transactionId?: string;
    stellarTxHash?: string;
    completed?: boolean;
    anchors?: Array<{
      role: "origin" | "destination";
      anchorName: string;
      interactiveId: string;
      ok: boolean;
      status?: string;
      stellarTxHash?: string;
      externalTransactionId?: string;
      error?: string;
    }>;
    error?: string;
  }>(response, endpoint);

  if (!response.ok || payload.status !== "ok" || !payload.transactionId) {
    throw new Error(payload.error || "Failed to poll transfer status");
  }

  return {
    status: "ok",
    transactionId: payload.transactionId,
    stellarTxHash: payload.stellarTxHash,
    completed: Boolean(payload.completed),
    anchors: payload.anchors ?? [],
  };
}
