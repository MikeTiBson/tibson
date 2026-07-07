export type BundleName =
  | "metadata"
  | "price"
  | "price-context"
  | "chad"
  | "soulbound"
  | "holder-buckets"
  | "coin-age"
  | "wallet-verification"
  | "dataset-details"
  | "metric-example";

export type MetadataBundle = {
  generatedAt: string;
  contractAddress: string;
  chain: string;
  metadata: Record<string, unknown>;
  updateCadence: {
    transactions: string;
    price: string;
  };
};

export type PricePoint = {
  date: string;
  priceUsd: number;
  source?: string | null;
};

export type PriceEvent = {
  date: string;
  chart_date?: string;
  time_utc?: string;
  title: string;
  tier: "major" | "noteworthy" | "lore";
  section: "key" | "lore";
  group: string;
  detail?: string;
  links?: Array<{ label: string; url: string }>;
};

export type PriceContextBundle = {
  events: PriceEvent[];
  zones: Array<{
    title: string;
    start: string;
    end: string;
    group?: string;
    detail?: string;
    links?: Array<{ label: string; url: string }>;
  }>;
};

export type PriceBundle = {
  latest: PricePoint | null;
  history: PricePoint[];
  sourceNote: string[];
};

export type ChadBundle = {
  criteria: string[];
  summary: {
    wallets: number;
    tibbirHeld: number;
    avgCoinAgeDays: number;
  };
  cohorts: Array<Record<string, number | string>>;
  wallets: Array<Record<string, number | string>>;
};

export type SoulboundBundle = {
  summary: Record<string, number | string> | null;
  history: Array<Record<string, number | string>>;
  wallets: Array<{ address: string; nft_quantity: number; balance: number }>;
  holdersUrl: string;
};

export type HolderBucketsBundle = {
  buckets: Array<{ label: string; pctColumn: string; countColumn: string }>;
  totalWallets: number;
  latest: Array<{
    bucket: string;
    wallets: number;
    walletSharePct: number;
    supplySharePct: number;
  }>;
  walletCountHistory: Array<Record<string, number | string>>;
  holderDistributionHistory: Array<Record<string, number | string>>;
};

export type CoinAgeBundle = {
  summary: {
    latestWeekStart: string | null;
    avgCoinAgeDays: number;
    includedBalance: number;
    excludedBalance: number;
    includedSupplyPct: number;
    excludedSupplyPct: number;
    includedWallets: number;
    excludedWallets: number;
    circulatingSupply: number;
    latestSnapshotBalance: number;
    latestSnapshotWallets: number;
  };
  buckets: Array<{ label: string }>;
  history: Array<{
    weekStart: string;
    avgCoinAgeDays: number | null;
    wallets: number;
    balance: number;
  }>;
  bucketHistory: Array<{
    weekStart: string;
    bucket: string;
    avgCoinAgeDays: number | null;
    wallets: number;
    balance: number;
  }>;
  excludedWallets: Array<{
    address: string;
    balance: number;
    tx_in: number;
    tx_out: number;
    reason: string;
    supplySharePct: number;
  }>;
};

export type WalletVerificationBundle = {
  walletSnapshot: Array<{ address: string; balance: number }>;
  recentTransactions: Array<Record<string, number | string>>;
  chadWallets: Array<Record<string, number | string>>;
  soulboundWallets: Array<{ address: string; nft_quantity: number; balance: number }>;
};

export type DatasetDetailsBundle = {
  contractAddress: string;
  metadata: Record<string, unknown>;
  transactionNotes: string[];
  priceNotes: string[];
};

export type MetricExampleBundle = {
  wallet: string;
  asOf: string;
  summary: {
    currentBalance: number;
    peakBalance: number;
    ofPeak: number;
    totalIn: number;
    totalOut: number;
    soldBought: number;
    avgCoinAgeDays: number;
  };
  rows: Array<{
    date: string;
    type: "in" | "out";
    amount: number;
    days: number;
    balanceBefore: number;
    ageBefore: number;
    balanceAfter: number;
    ageAfter: number;
  }>;
};
