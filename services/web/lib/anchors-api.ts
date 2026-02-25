import { apiUrl } from "./api";
import type { AnchorCountry, ProofOfPayment, RemittanceRoute } from "./types";

export async function fetchAnchorCountries(): Promise<AnchorCountry[]> {
  const response = await fetch(apiUrl("/api/anchors/countries"), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    countries?: AnchorCountry[];
    error?: string;
  };

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
  const response = await fetch(apiUrl("/api/compare-routes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = (await response.json()) as {
    routes?: RemittanceRoute[];
    meta?: { noRouteReason?: string };
    error?: string;
  };

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
  const response = await fetch(apiUrl("/api/execute-transfer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "prepare",
      route: params.route,
      amount: params.amount,
      senderAccount: params.senderAccount,
    }),
  });

  const payload = (await response.json()) as {
    status?: string;
    prepared?: PreparedTransfer;
    error?: string;
  };

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
  const response = await fetch(apiUrl("/api/execute-transfer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "authorize",
      prepared: params.prepared,
      signatures: params.signatures,
    }),
  });

  const payload = (await response.json()) as {
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
  };

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
  const response = await fetch(apiUrl("/api/generate-proof"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = (await response.json()) as {
    proof?: ProofOfPayment;
    error?: string;
  };

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
  const response = await fetch(apiUrl("/api/execute-transfer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase: "status",
      transactionId: params.transactionId,
      statusRef: params.statusRef,
    }),
  });

  const payload = (await response.json()) as {
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
  };

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
