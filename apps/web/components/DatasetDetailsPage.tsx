"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fmtNumber } from "@/lib/format";
import type { DatasetDetailsBundle, WalletVerificationBundle } from "@/lib/types";

async function fetchBundle<T>(name: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return response.json();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export function DatasetDetailsPage() {
  const [details, setDetails] = useState<DatasetDetailsBundle | null>(null);
  const [verification, setVerification] = useState<WalletVerificationBundle | null>(null);
  const [walletQuery, setWalletQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchBundle<DatasetDetailsBundle>("dataset-details"), fetchBundle<WalletVerificationBundle>("wallet-verification")])
      .then(([dataset, walletData]) => {
        setDetails(dataset);
        setVerification(walletData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dataset details"));
  }, []);

  if (error) return <main className="page"><div className="status">{error}</div></main>;
  if (!details || !verification) return <main className="page"><div className="status">Loading dataset details...</div></main>;

  const metadata = details.metadata;
  const walletRows = verification.walletSnapshot
    .filter((row) => row.address.includes(walletQuery.toLowerCase()))
    .slice(0, 500);

  return (
    <main className="page">
      <p><Link href="/">Back to dashboard</Link></p>
      <header className="brand">
        <h1>tibson analytics</h1>
        <Image src="/tibson.avif" alt="tibson" width={88} height={88} />
      </header>
      <section className="section">
        <h2>Contract & Supply</h2>
        <div className="metric-grid">
          <Metric label="Contract" value={details.contractAddress.slice(0, 10) + "..."} />
          <Metric label="Total initial supply" value={fmtNumber(Number(metadata.total_minted_supply || 0))} />
          <Metric label="Latest block" value={fmtNumber(Number(metadata.end_block || 0))} />
        </div>
      </section>
      <section className="section">
        <h2>Transaction data</h2>
        <ul className="note-list">{details.transactionNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        <details className="details">
          <summary>Public dataset</summary>
          <div className="details-body">
            <p>The full transaction dataset is published to a public Google Storage bucket.</p>
            <ul>
              <li><a href={details.publicDataset.metadata}>Metadata</a></li>
              <li><a href={details.publicDataset.schema}>Schema</a></li>
              <li><a href={details.publicDataset.sampleTransactions}>Sample transactions</a></li>
              <li><a href={details.publicDataset.fullTransactionHistory}>Full transaction history</a></li>
            </ul>
          </div>
        </details>
        <details className="details">
          <summary>Verify wallet balances and latest transactions</summary>
          <div className="details-body">
            <div className="metric-grid">
              <Metric label="Last updated" value={String(metadata.last_updated_utc || "-").replace("T", " ").slice(0, 16) + " UTC"} />
              <Metric label="Latest block" value={fmtNumber(Number(metadata.end_block || 0))} />
            </div>
            <input className="search" value={walletQuery} onChange={(event) => setWalletQuery(event.target.value)} placeholder="Search wallet" />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Wallet</th><th>TIBBIR held</th></tr></thead>
                <tbody>{walletRows.map((row) => <tr key={row.address}><td>{row.address}</td><td>{fmtNumber(row.balance)}</td></tr>)}</tbody>
              </table>
            </div>
            <h3>Latest transactions</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Timestamp</th><th>Tx</th><th>Amount</th></tr></thead>
                <tbody>{verification.recentTransactions.slice(0, 100).map((row, idx) => <tr key={idx}><td>{String(row.timestamp || "")}</td><td>{String(row.tx_hash || "").slice(0, 12)}...</td><td>{fmtNumber(Number(row.amount || 0), 2)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </details>
      </section>
      <section className="section">
        <h2>Price data</h2>
        <ul className="note-list">{details.priceNotes.map((note) => <li key={note}>{note}</li>)}</ul>
      </section>
    </main>
  );
}
