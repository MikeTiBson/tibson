import { z } from "zod";
import type { BundleName } from "./types";

const looseRecord = z.record(z.string(), z.unknown());
const numberOrString = z.union([z.number(), z.string()]);
const looseDataRow = z.record(z.string(), numberOrString);
const linkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

const schemas = {
  metadata: z.object({
    generatedAt: z.string(),
    contractAddress: z.string(),
    chain: z.string(),
    metadata: looseRecord,
    updateCadence: z.object({
      transactions: z.string(),
      price: z.string(),
    }),
  }),
  price: z.object({
    latest: z.object({ date: z.string(), priceUsd: z.number() }).nullable(),
    history: z.array(z.object({ date: z.string(), priceUsd: z.number() })),
    sourceNote: z.array(z.string()),
  }),
  "price-context": z.object({
    events: z.array(z.object({
      date: z.string(),
      chart_date: z.string().optional(),
      time_utc: z.string().optional(),
      title: z.string(),
      tier: z.enum(["major", "noteworthy", "lore"]),
      section: z.enum(["key", "lore"]),
      group: z.string(),
      detail: z.string().optional(),
      links: z.array(linkSchema).optional(),
    })),
    zones: z.array(z.object({
      title: z.string(),
      start: z.string(),
      end: z.string(),
      group: z.string().optional(),
      detail: z.string().optional(),
      links: z.array(linkSchema).optional(),
    })),
  }),
  chad: z.object({
    criteria: z.array(z.string()),
    summary: z.object({
      wallets: z.number(),
      tibbirHeld: z.number(),
      avgCoinAgeDays: z.number(),
    }),
    cohorts: z.array(looseDataRow),
    wallets: z.array(looseDataRow),
  }),
  soulbound: z.object({
    summary: looseRecord.nullable(),
    history: z.array(looseDataRow),
    wallets: z.array(z.object({
      address: z.string(),
      nft_quantity: z.number(),
      balance: z.number(),
    })),
    holdersUrl: z.string().url(),
  }),
  "holder-buckets": z.object({
    buckets: z.array(z.object({
      label: z.string(),
      pctColumn: z.string(),
      countColumn: z.string(),
    })),
    totalWallets: z.number(),
    latest: z.array(z.object({
      bucket: z.string(),
      wallets: z.number(),
      walletSharePct: z.number(),
      supplySharePct: z.number(),
    })),
    walletCountHistory: z.array(looseDataRow),
    holderDistributionHistory: z.array(looseDataRow),
  }),
  "wallet-verification": z.object({
    walletSnapshot: z.array(z.object({ address: z.string(), balance: z.number() })),
    recentTransactions: z.array(looseDataRow),
    chadWallets: z.array(looseDataRow),
    soulboundWallets: z.array(z.object({
      address: z.string(),
      nft_quantity: z.number(),
      balance: z.number(),
    })),
  }),
  "dataset-details": z.object({
    contractAddress: z.string(),
    metadata: looseRecord,
    publicDataset: z.record(z.string(), z.string().url()),
    transactionNotes: z.array(z.string()),
    priceNotes: z.array(z.string()),
  }),
  "metric-example": z.object({
    wallet: z.string(),
    asOf: z.string(),
    summary: z.object({
      currentBalance: z.number(),
      peakBalance: z.number(),
      ofPeak: z.number(),
      totalIn: z.number(),
      totalOut: z.number(),
      soldBought: z.number(),
      avgCoinAgeDays: z.number(),
    }),
    rows: z.array(z.object({
      date: z.string(),
      type: z.enum(["in", "out"]),
      amount: z.number(),
      days: z.number(),
      balanceBefore: z.number(),
      ageBefore: z.number(),
      balanceAfter: z.number(),
      ageAfter: z.number(),
    })),
  }),
} satisfies Record<BundleName, z.ZodType>;

export function validateDashboardBundle(name: BundleName, data: unknown) {
  const result = schemas[name].safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "root";
    throw new Error(`Invalid dashboard bundle ${name}: ${path} ${issue?.message || "failed validation"}`);
  }
  return result.data;
}
