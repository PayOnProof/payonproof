export interface Anchor {
  id: string;
  name: string;
  country: string;
  currency: string;
  type: "on-ramp" | "off-ramp";
  status: "operational" | "degraded" | "offline";
  available: boolean;
}

export interface RemittanceRoute {
  id: string;
  originAnchor: Anchor;
  destinationAnchor: Anchor;
  originCountry: string;
  originCurrency: string;
  destinationCountry: string;
  destinationCurrency: string;
  feePercentage: number;
  feeAmount: number;
  feeBreakdown: {
    onRamp: number;
    bridge: number;
    offRamp: number;
  };
  estimatedTime: string;
  estimatedMinutes: number;
  exchangeRate: number;
  receivedAmount: number;
  available: boolean;
  escrow: boolean;
  risks: string[];
  recommended: boolean;
  score?: number;
}

export interface ProofOfPayment {
  id: string;
  transactionId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  originAmount: number;
  originCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  exchangeRate: number;
  totalFees: number;
  route: string;
  stellarTxHash: string;
  status: "verified";
}

export interface Transaction {
  id: string;
  route: RemittanceRoute;
  amount: number;
  status: "pending" | "processing" | "escrow" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  stellarTxHash?: string;
  proofOfPayment?: ProofOfPayment;
}

export interface AnchorCountry {
  code: string;
  name: string;
  currencies: string[];
  onRampCount: number;
  offRampCount: number;
  operationalAnchors: number;
}
