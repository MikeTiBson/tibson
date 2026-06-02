import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BundleName } from "./types";

const ALLOWED_BUNDLES = new Set<BundleName>([
  "metadata",
  "price",
  "price-context",
  "chad",
  "soulbound",
  "holder-buckets",
  "wallet-verification",
  "dataset-details",
  "metric-example",
]);

type R2Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  secretAccessKey: string;
  prefix: string;
};

function valueFromRecord(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseExampleUsage(text: string) {
  const find = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return undefined;
  };
  return {
    accessKeyId: find([
      /AWS_ACCESS_KEY_ID=([^\s]+)/i,
      /Access Key ID\s*[:=]\s*([^\s]+)/i,
    ]),
    endpoint: find([
      /(https:\/\/[^\s'"]+\.r2\.cloudflarestorage\.com)/i,
    ]),
    secretAccessKey: find([
      /AWS_SECRET_ACCESS_KEY=([^\s]+)/i,
      /Secret Access Key\s*[:=]\s*([^\s]+)/i,
    ]),
  };
}

async function loadLocalR2ConfigFile() {
  const configuredPath = process.env.R2_CONFIG_FILE;
  const candidates = [
    configuredPath,
    path.join(process.cwd(), "R2.json"),
    path.join(process.cwd(), "R2 User Token.json"),
    path.join(process.cwd(), "..", "R2.json"),
    path.join(process.cwd(), "..", "R2 User Token.json"),
    path.join(process.cwd(), "..", "..", "R2.json"),
    path.join(process.cwd(), "..", "..", "R2 User Token.json"),
  ].filter(Boolean) as string[];

  const configPath = candidates.find((candidate) => existsSync(candidate));
  if (!configPath) return {};

  const raw = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const exampleUsage = valueFromRecord(parsed, ["Example usage", "exampleUsage"]) || "";
  const example = parseExampleUsage(exampleUsage);
  const accountId = valueFromRecord(parsed, ["account ID", "accountId", "R2_ACCOUNT_ID"]);
  return {
    accessKeyId: valueFromRecord(parsed, ["Access Key ID", "accessKeyId", "R2_ACCESS_KEY_ID"]) || example.accessKeyId,
    bucket: valueFromRecord(parsed, ["Bucket", "bucket", "R2_BUCKET"]),
    endpoint:
      valueFromRecord(parsed, ["Default", "S3 API", "endpoint", "R2_ENDPOINT"]) ||
      example.endpoint ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined),
    secretAccessKey: valueFromRecord(parsed, ["Secret Access Key", "secretAccessKey", "R2_SECRET_ACCESS_KEY"]) || example.secretAccessKey,
  };
}

async function r2Config(): Promise<R2Config> {
  const localConfig = await loadLocalR2ConfigFile();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || localConfig.accessKeyId;
  const bucket = process.env.R2_BUCKET || localConfig.bucket || "tibson-data";
  const endpoint = process.env.R2_ENDPOINT || localConfig.endpoint;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || localConfig.secretAccessKey;

  if (!accessKeyId || !endpoint || !secretAccessKey) {
    throw new Error("R2 is missing Access Key ID, Secret Access Key, or endpoint");
  }

  return {
    accessKeyId,
    bucket,
    endpoint,
    secretAccessKey,
    prefix: process.env.R2_DASHBOARD_PREFIX || "dashboard",
  };
}

function r2Client(config: R2Config) {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: "auto",
  });
}

async function readR2DashboardBundle(name: BundleName) {
  const config = await r2Config();

  const response = await r2Client(config).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: `${config.prefix}/${name}.json`,
  }));
  const text = await response.Body?.transformToString();
  if (!text) throw new Error(`Empty R2 dashboard bundle: ${name}`);
  return JSON.parse(text);
}

export function assertBundleName(name: string): asserts name is BundleName {
  if (!ALLOWED_BUNDLES.has(name as BundleName)) {
    throw new Error(`Unknown dashboard bundle: ${name}`);
  }
}

export async function readDashboardBundle(name: BundleName) {
  const localDir = process.env.DASHBOARD_DATA_DIR;
  if (localDir) {
    const filePath = path.join(localDir, `${name}.json`);
    return JSON.parse(await readFile(filePath, "utf-8"));
  }

  return readR2DashboardBundle(name);
}
