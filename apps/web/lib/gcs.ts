import { readFile } from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
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

function storageClient() {
  const credentialsJson = process.env.GCP_SA_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    return new Storage({ credentials: JSON.parse(credentialsJson) });
  }
  return new Storage();
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

  const bucketName = process.env.TIBBIR_GCS_BUCKET || "tibbir-data";
  const prefix = process.env.TIBBIR_DASHBOARD_PREFIX || "dashboard";
  const [bytes] = await storageClient().bucket(bucketName).file(`${prefix}/${name}.json`).download();
  return JSON.parse(bytes.toString("utf-8"));
}
