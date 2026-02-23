export interface CompareRoutesInput {
  origin: string;
  destination: string;
  amount: number;
}

export interface AnchorCatalogEntry {
  id: string;
  name: string;
  domain: string;
  country: string;
  currency: string;
  type: "on-ramp" | "off-ramp";
  capabilities: {
    sep24: boolean;
    sep6: boolean;
    sep31: boolean;
    sep10: boolean;
    operational: boolean;
    feeFixed?: number;
    feePercent?: number;
    feeSource?: "sep24" | "sep6" | "default";
    transferServerSep24?: string;
    transferServerSep6?: string;
    webAuthEndpoint?: string;
    directPaymentServer?: string;
    kycServer?: string;
    lastCheckedAt?: string;
    diagnostics?: string[];
  };
}

export interface AnchorRuntime {
  catalog: AnchorCatalogEntry;
  sep: {
    sep24: boolean;
    sep6: boolean;
    sep31: boolean;
  };
  endpoints: {
    webAuthEndpoint?: string;
    transferServerSep24?: string;
    transferServerSep6?: string;
    directPaymentServer?: string;
  };
  operational: boolean;
  diagnostics: string[];
  fees: {
    fixed?: number;
    percent?: number;
    source?: "sep24" | "sep6" | "default";
  };
}

export interface RemittanceRoute {
  id: string;
  originAnchor: {
    id: string;
    name: string;
    country: string;
    currency: string;
    type: "on-ramp";
    status: "operational" | "degraded" | "offline";
    available: boolean;
  };
  destinationAnchor: {
    id: string;
    name: string;
    country: string;
    currency: string;
    type: "off-ramp";
    status: "operational" | "degraded" | "offline";
    available: boolean;
  };
  originCountry: string;
  originCurrency: string;
  destinationCountry: string;
  destinationCurrency: string;
  feePercentage: number;
  feeAmount: number;
  feeBreakdown: { onRamp: number; bridge: number; offRamp: number };
  estimatedTime: string;
  estimatedMinutes: number;
  exchangeRate: number;
  receivedAmount: number;
  available: boolean;
  escrow: boolean;
  risks: string[];
  recommended: boolean;
  score: number;
}
