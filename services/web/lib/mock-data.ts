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
  // North America
  { code: "US", name: "United States", currency: "USD", flag: "US", region: "North America" },
  { code: "CA", name: "Canada", currency: "CAD", flag: "CA", region: "North America" },
  { code: "MX", name: "Mexico", currency: "MXN", flag: "MX", region: "North America" },
  // Central America
  { code: "CR", name: "Costa Rica", currency: "CRC", flag: "CR", region: "Central America" },
  { code: "PA", name: "Panama", currency: "USD", flag: "PA", region: "Central America" },
  // South America
  { code: "CO", name: "Colombia", currency: "COP", flag: "CO", region: "South America" },
  { code: "AR", name: "Argentina", currency: "ARS", flag: "AR", region: "South America" },
  { code: "BR", name: "Brazil", currency: "BRL", flag: "BR", region: "South America" },
  { code: "CL", name: "Chile", currency: "CLP", flag: "CL", region: "South America" },
  { code: "PE", name: "Peru", currency: "PEN", flag: "PE", region: "South America" },
  { code: "EC", name: "Ecuador", currency: "USD", flag: "EC", region: "South America" },
  { code: "BO", name: "Bolivia", currency: "BOB", flag: "BO", region: "South America" },
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
    name: "AnchorUSD",
    country: "US",
    currency: "USD",
    type: "on-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-6",
    name: "Settle Network",
    country: "CO",
    currency: "COP",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-7",
    name: "Mercado Pago",
    country: "BR",
    currency: "BRL",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-8",
    name: "Buda.com",
    country: "CL",
    currency: "CLP",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-9",
    name: "CoolPay CR",
    country: "CR",
    currency: "CRC",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-10",
    name: "TowerBank",
    country: "PA",
    currency: "USD",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-11",
    name: "Interbank Peru",
    country: "PE",
    currency: "PEN",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-12",
    name: "Produbanco",
    country: "EC",
    currency: "USD",
    type: "off-ramp",
    status: "degraded",
    available: true,
  },
  {
    id: "anc-13",
    name: "Banco Ganadero",
    country: "BO",
    currency: "BOB",
    type: "off-ramp",
    status: "operational",
    available: true,
  },
  {
    id: "anc-14",
    name: "Shakepay",
    country: "CA",
    currency: "CAD",
    type: "on-ramp",
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
    // USD pairs
    "USD-MXN": 17.15,
    "USD-COP": 3950,
    "USD-ARS": 875,
    "USD-BRL": 4.97,
    "USD-CLP": 890,
    "USD-PEN": 3.72,
    "USD-CRC": 525,
    "USD-BOB": 6.91,
    "USD-CAD": 1.36,
    "USD-USD": 1,
    // Reverse to USD
    "MXN-USD": 0.058,
    "COP-USD": 0.00025,
    "ARS-USD": 0.00114,
    "BRL-USD": 0.201,
    "CLP-USD": 0.00112,
    "PEN-USD": 0.269,
    "CRC-USD": 0.0019,
    "BOB-USD": 0.145,
    "CAD-USD": 0.735,
    // Cross-LATAM common pairs
    "MXN-COP": 230.3,
    "BRL-ARS": 176,
    "COP-MXN": 0.00434,
    "ARS-BRL": 0.00568,
    "CLP-COP": 4.44,
    "PEN-COP": 1062,
    "CAD-MXN": 12.61,
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
