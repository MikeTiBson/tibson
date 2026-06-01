"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { basescanTokenUrl, fmtNumber, shortAddress } from "@/lib/format";
import type { DatasetDetailsBundle, PriceBundle, WalletVerificationBundle } from "@/lib/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

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

function TableScrollTip() {
  return (
    <span
      aria-label="This table scrolls sideways on small screens."
      className="table-scroll-tip"
      data-tooltip="This table scrolls sideways on small screens."
      role="img"
      tabIndex={0}
    >
      i
    </span>
  );
}

function basescanTokenHolderUrl(contract: string, address?: string) {
  const base = `https://basescan.org/token/${contract}`;
  return address ? `${base}?a=${address}` : base;
}

function basescanTxUrl(txHash: string) {
  return `https://basescan.org/tx/${txHash}`;
}

function priceSourceLabel(date: string, source?: string | null) {
  if (source === "launch_baseline") return "Launch baseline";
  if (source === "dex_reserve_proxy") return "DEX reserve proxy";
  if (source === "alchemy_prices") return "Alchemy prices";
  if (source) return source.replaceAll("_", " ");
  if (date >= "2025-01-12" && date <= "2025-03-24") return "DEX reserve proxy";
  if (date >= "2025-03-25") return "Alchemy prices";
  return "Launch baseline";
}

function SupplyAddress({ label, address, href }: { label: string; address: string; href: string }) {
  return (
    <div className="supply-item">
      <div className="supply-label">{label}</div>
      <a className="address-link external-link" href={href} target="_blank" aria-label={`${label} on BaseScan`}>
        {address}
      </a>
    </div>
  );
}

function SupplyValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="supply-item">
      <div className="supply-label">{label}</div>
      <div className="supply-value">{fmtNumber(value)}</div>
    </div>
  );
}

function PythonQuickstart({ publicBaseUrl }: { publicBaseUrl: string }) {
  return (
    <pre className="code-block language-python">
      <code className="language-python">
        <span className="code-keyword">import</span> requests{"\n"}
        <span className="code-keyword">import</span> pandas <span className="code-keyword">as</span> pd{"\n\n"}
        base <span className="code-operator">=</span> <span className="code-string">&quot;{publicBaseUrl}&quot;</span>{"\n"}
        metadata <span className="code-operator">=</span> requests.get(f<span className="code-string">&quot;{`{base}`}/metadata.json&quot;</span>).json(){"\n"}
        schema <span className="code-operator">=</span> requests.get(f<span className="code-string">&quot;{`{base}`}/schema.json&quot;</span>).json(){"\n"}
        sample <span className="code-operator">=</span> pd.read_parquet(f<span className="code-string">&quot;{`{base}`}/sample_transfers.parquet&quot;</span>){"\n"}
        transactions <span className="code-operator">=</span> pd.read_parquet(f<span className="code-string">&quot;{`{base}`}/transfers_master.parquet&quot;</span>)
      </code>
    </pre>
  );
}

export function DatasetDetailsPage() {
  const [details, setDetails] = useState<DatasetDetailsBundle | null>(null);
  const [verification, setVerification] = useState<WalletVerificationBundle | null>(null);
  const [price, setPrice] = useState<PriceBundle | null>(null);
  const [walletQuery, setWalletQuery] = useState("");
  const [verificationView, setVerificationView] = useState<"wallets" | "transactions">("wallets");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchBundle<DatasetDetailsBundle>("dataset-details"),
      fetchBundle<WalletVerificationBundle>("wallet-verification"),
      fetchBundle<PriceBundle>("price"),
    ])
      .then(([dataset, walletData, priceData]) => {
        setDetails(dataset);
        setVerification(walletData);
        setPrice(priceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dataset details"));
  }, []);

  if (error) return <main className="page"><div className="status">{error}</div></main>;
  if (!details || !verification || !price) return <main className="page"><div className="status">Loading dataset details...</div></main>;

  const metadata = details.metadata;
  const normalizedWalletQuery = walletQuery.trim().toLowerCase();
  const walletRows = verification.walletSnapshot
    .filter((row) => normalizedWalletQuery && row.address.includes(normalizedWalletQuery))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 50);
  const recentTransactionRows = [...verification.recentTransactions]
    .sort((a, b) => Date.parse(String(b.timestamp || "")) - Date.parse(String(a.timestamp || "")))
    .slice(0, 100);
  const totalSupply = Number(metadata.total_minted_supply || 0);
  const burnedSupply = Number(metadata.burned_supply || 0);
  const deadSupply = Number(metadata.dead_address_supply || 0);
  const publicBaseUrl = details.publicDataset.baseUrl || "https://storage.googleapis.com/tibson-public";

  return (
    <main className="page">
      <p><Link href="/">Back to dashboard</Link></p>
      <header className="brand brand-logo-only">
        <Image src="/tibson.avif" alt="tibson" width={88} height={88} />
      </header>
      <section className="section dataset-summary">
        <h2>Contract & Supply</h2>
        <div className="supply-grid">
          <div className="supply-stack">
            <SupplyAddress label="Token" address={details.contractAddress} href={basescanTokenHolderUrl(details.contractAddress)} />
            <SupplyAddress label="Burn address" address={ZERO_ADDRESS} href={basescanTokenHolderUrl(details.contractAddress, ZERO_ADDRESS)} />
            <SupplyAddress label="Dead address" address={DEAD_ADDRESS} href={basescanTokenHolderUrl(details.contractAddress, DEAD_ADDRESS)} />
          </div>
          <div className="supply-stack">
            <SupplyValue label="Total initial supply" value={totalSupply} />
            <SupplyValue label="Initial supply - burns" value={totalSupply - burnedSupply} />
            <SupplyValue label="Initial supply - (burns + dead)" value={totalSupply - burnedSupply - deadSupply} />
          </div>
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
              <li><a href={details.publicDataset.metadata}>Metadata</a>: dataset stats and file listing.</li>
              <li><a href={details.publicDataset.schema}>Schema</a>: column definitions, dtypes, examples, and Python quickstart.</li>
              <li><a href={details.publicDataset.sampleTransactions}>Sample transactions</a>: first 1,000 rows for quick inspection.</li>
              <li><a href={details.publicDataset.fullTransactionHistory}>Full transaction history</a>: complete Parquet dataset.</li>
            </ul>
            <div className="code-heading">Quickstart</div>
            <PythonQuickstart publicBaseUrl={publicBaseUrl} />
          </div>
        </details>
        <details className="details">
          <summary>Verify wallet balances and latest transactions</summary>
          <div className="details-body">
            <div className="metric-grid">
              <Metric label="Last updated" value={String(metadata.last_updated_utc || "-").replace("T", " ").slice(0, 16) + " UTC"} />
              <Metric label="Latest block" value={fmtNumber(Number(metadata.end_block || 0))} />
            </div>
            <div className="view-tabs compact-tabs" role="tablist" aria-label="Verification views">
              <button
                type="button"
                role="tab"
                aria-selected={verificationView === "wallets"}
                className={`tab-button ${verificationView === "wallets" ? "active" : ""}`}
                onClick={() => setVerificationView("wallets")}
              >
                Wallet balances
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={verificationView === "transactions"}
                className={`tab-button ${verificationView === "transactions" ? "active" : ""}`}
                onClick={() => setVerificationView("transactions")}
              >
                Latest transactions
              </button>
            </div>
            {verificationView === "wallets" ? (
              <>
                <input className="search" value={walletQuery} onChange={(event) => setWalletQuery(event.target.value)} placeholder="Search wallet" />
                {normalizedWalletQuery ? (
                  <div className="table-scroll-shell">
                    <TableScrollTip />
                    <div className="table-wrap scroll-table">
                      <table>
                        <thead><tr><th>Wallet</th><th>BaseScan</th><th>TIBBIR held</th></tr></thead>
                        <tbody>{walletRows.map((row) => (
                          <tr key={row.address}>
                            <td>{shortAddress(row.address)}</td>
                            <td><a href={basescanTokenUrl(details.contractAddress, row.address)} target="_blank">open</a></td>
                            <td>{fmtNumber(row.balance)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">Search for a wallet address to verify its current TIBBIR balance.</p>
                )}
              </>
            ) : (
              <>
                <p className="table-note">Showing last 100 transactions included in the data.</p>
                <div className="table-scroll-shell">
                  <TableScrollTip />
                  <div className="table-wrap scroll-table">
                    <table className="transactions-table">
                      <thead><tr><th>Timestamp</th><th>BaseScan</th><th>Amount</th></tr></thead>
                      <tbody>{recentTransactionRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>{String(row.timestamp || "")}</td>
                          <td><a href={basescanTxUrl(String(row.tx_hash || ""))} target="_blank">open</a></td>
                          <td>{fmtNumber(Number(row.amount || 0), 2)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </details>
      </section>
      <section className="section">
        <h2>Price data</h2>
        <ul className="note-list">{details.priceNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        <details className="details">
          <summary>Inspect raw price data</summary>
          <div className="details-body">
            <div className="table-scroll-shell">
              <TableScrollTip />
              <div className="table-wrap scroll-table">
                <table>
                  <thead><tr><th>Date</th><th>Price USD</th><th>Source</th></tr></thead>
                  <tbody>{price.history.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{fmtNumber(row.priceUsd, 6)}</td>
                      <td>{priceSourceLabel(row.date, row.source)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}
