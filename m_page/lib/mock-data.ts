export interface Anchor {
  id: string;
  name: string;
  country: string;
  currency: string;
  type: "on-ramp" | "off-ramp" | "bridge";
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
}

export interface Transaction {
  id: string;
  route: RemittanceRoute;
  amount: number;
  status:
    | "pending"
    | "processing"
    | "escrow"
    | "completed"
    | "failed";
  createdAt: string;
  completedAt?: string;
  stellarTxHash?: string;
  proofOfPayment?: ProofOfPayment;
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

export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "US" },
  { code: "MX", name: "Mexico", currency: "MXN", flag: "MX" },
  { code: "CO", name: "Colombia", currency: "COP", flag: "CO" },
  { code: "AR", name: "Argentina", currency: "ARS", flag: "AR" },
  { code: "BR", name: "Brazil", currency: "BRL", flag: "BR" },
  { code: "CL", name: "Chile", currency: "CLP", flag: "CL" },
  { code: "PE", name: "Peru", currency: "PEN", flag: "PE" },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "NG" },
  { code: "PH", name: "Philippines", currency: "PHP", flag: "PH" },
  { code: "IN", name: "India", currency: "INR", flag: "IN" },
];

const anchors: Anchor[] = [
  {
    id: "anc-1",
    name: "MoneyGram",
    country: "US",
    currency: "USD",
    type: "on-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-2",
    name: "Bitso",
    country: "MX",
    currency: "MXN",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-3",
    name: "Tempo",
    country: "US",
    currency: "USD",
    type: "on-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-4",
    name: "SatoshiTango",
    country: "AR",
    currency: "ARS",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-5",
    name: "Cowrie",
    country: "NG",
    currency: "NGN",
    type: "off-ramp",
    status: "degraded",
    available: true,
  },
  {
    id: "anc-6",
    name: "AnchorUSD",
    country: "US",
    currency: "USD",
    type: "on-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-7",
    name: "Settle Network",
    country: "CO",
    currency: "COP",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-8",
    name: "Coins.ph",
    country: "PH",
    currency: "PHP",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
];

export function generateRoutes(
  originCountry: string,
  destinationCountry: string,
  amount: number
): RemittanceRoute[] {
  const origin = COUNTRIES.find((c) => c.code === originCountry);
  const dest = COUNTRIES.find((c) => c.code === destinationCountry);

  if (!origin || !dest) return [];

  const exchangeRates: Record<string, number> = {
    "USD-MXN": 17.15,
    "USD-COP": 3950,
    "USD-ARS": 875,
    "USD-BRL": 4.97,
    "USD-CLP": 890,
    "USD-PEN": 3.72,
    "USD-NGN": 1550,
    "USD-PHP": 56.2,
    "USD-INR": 83.1,
    "MXN-USD": 0.058,
    "COP-USD": 0.00025,
    "ARS-USD": 0.00114,
    "BRL-USD": 0.201,
    "NGN-USD": 0.00065,
    "PHP-USD": 0.0178,
  };

  const rateKey = `${origin.currency}-${dest.currency}`;
  const baseRate = exchangeRates[rateKey] || 1;

  const originAnchors = anchors.filter(
    (a) =>
      a.country === originCountry ||
      (a.type === "on-ramp" && a.currency === origin.currency)
  );
  const destAnchors = anchors.filter(
    (a) =>
      a.country === destinationCountry ||
      (a.type === "off-ramp" && a.currency === dest.currency)
  );

  if (originAnchors.length === 0 || destAnchors.length === 0) {
    const mockOnRamp: Anchor = {
      id: `anc-mock-on-${originCountry}`,
      name: `${origin.name} Gateway`,
      country: originCountry,
      currency: origin.currency,
      type: "on-ramp",
      status: "operational",
      available: true,
    };
    const mockOffRamp: Anchor = {
      id: `anc-mock-off-${destinationCountry}`,
      name: `${dest.name} Gateway`,
      country: destinationCountry,
      currency: dest.currency,
      type: "off-ramp",
      status: "operational",
      available: true,
    };

    if (originAnchors.length === 0) originAnchors.push(mockOnRamp);
    if (destAnchors.length === 0) destAnchors.push(mockOffRamp);
  }

  const routes: RemittanceRoute[] = [];

  for (const oa of originAnchors) {
    for (const da of destAnchors) {
      const feeVariance = 0.5 + Math.random() * 2.5;
      const onRampFee = 0.2 + Math.random() * 0.8;
      const bridgeFee = 0.05 + Math.random() * 0.3;
      const offRampFee = 0.2 + Math.random() * 0.6;
      const totalFeePercentage =
        Math.round((onRampFee + bridgeFee + offRampFee) * 100) / 100;
      const feeAmount = Math.round(amount * (totalFeePercentage / 100) * 100) / 100;
      const rateSpread = 1 - (0.001 + Math.random() * 0.008);
      const effectiveRate = Math.round(baseRate * rateSpread * 100) / 100;
      const receivedAmount =
        Math.round((amount - feeAmount) * effectiveRate * 100) / 100;
      const timeOptions = [5, 15, 30, 60, 120, 1440];
      const estimatedMinutes =
        timeOptions[Math.floor(Math.random() * timeOptions.length)];

      let estimatedTime: string;
      if (estimatedMinutes < 60) {
        estimatedTime = `${estimatedMinutes} min`;
      } else if (estimatedMinutes < 1440) {
        estimatedTime = `${estimatedMinutes / 60} hrs`;
      } else {
        estimatedTime = "1 day";
      }

      const risks: string[] = [];
      if (da.status === "degraded") risks.push("Destination anchor experiencing delays");
      if (estimatedMinutes >= 1440) risks.push("Settlement may take up to 24 hours");
      if (totalFeePercentage > 2) risks.push("Higher than average fee");

      routes.push({
        id: `route-${oa.id}-${da.id}-${Math.random().toString(36).slice(2, 6)}`,
        originAnchor: oa,
        destinationAnchor: da,
        originCountry,
        originCurrency: origin.currency,
        destinationCountry,
        destinationCurrency: dest.currency,
        feePercentage: totalFeePercentage,
        feeAmount,
        feeBreakdown: {
          onRamp: Math.round(onRampFee * 100) / 100,
          bridge: Math.round(bridgeFee * 100) / 100,
          offRamp: Math.round(offRampFee * 100) / 100,
        },
        estimatedTime,
        estimatedMinutes,
        exchangeRate: effectiveRate,
        receivedAmount,
        available: oa.available && da.available,
        escrow: Math.random() > 0.5,
        risks,
        recommended: false,
      });
    }
  }

  if (routes.length > 0) {
    const sorted = [...routes]
      .filter((r) => r.available)
      .sort((a, b) => {
        const scoreA = a.feePercentage + a.estimatedMinutes / 60;
        const scoreB = b.feePercentage + b.estimatedMinutes / 60;
        return scoreA - scoreB;
      });
    if (sorted.length > 0) {
      const best = routes.find((r) => r.id === sorted[0].id);
      if (best) best.recommended = true;
    }
  }

  return routes.sort((a, b) => {
    if (a.recommended) return -1;
    if (b.recommended) return 1;
    return a.feePercentage - b.feePercentage;
  });
}

export function generateStellarHash(): string {
  const chars = "abcdef0123456789";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function generateTransactionId(): string {
  return `POP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
