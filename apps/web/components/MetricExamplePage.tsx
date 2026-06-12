"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { basescanTokenUrl, fmtNumber, fmtPct } from "@/lib/format";
import type { MetadataBundle, MetricExampleBundle } from "@/lib/types";

async function fetchBundle<T>(name: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return response.json();
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

function PageLoader() {
  return (
    <main className="page loading-page">
      <div className="tibson-loader" role="status" aria-live="polite">
        <Image className="tibson-loader-img" src="/tibson.avif" alt="" width={82} height={82} priority />
        <span>Loading...</span>
      </div>
    </main>
  );
}

export function MetricExamplePage() {
  const [example, setExample] = useState<MetricExampleBundle | null>(null);
  const [metadata, setMetadata] = useState<MetadataBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchBundle<MetricExampleBundle>("metric-example"), fetchBundle<MetadataBundle>("metadata")])
      .then(([metricExample, meta]) => {
        setExample(metricExample);
        setMetadata(meta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load example"));
  }, []);

  if (error) return <main className="page"><div className="status">{error}</div></main>;
  if (!example || !metadata) return <PageLoader />;

  return (
    <main className="page">
      <p><Link href="/">Back to dashboard</Link></p>
      <section className="section">
        <h2>Example - Chad metrics</h2>
        <p><a className="external-link" href={basescanTokenUrl(metadata.contractAddress, example.wallet)} target="_blank">{example.wallet}</a></p>
        <p><strong>This worked example is time-frozen at {example.asOf.replace("T", " ").replace(":00Z", " UTC")}.</strong></p>
      </section>
      <section className="section">
        <h2>Inclusion criterias</h2>
        <ul className="note-list">
          <li>Current holdings are at least 90% of peak holdings: {"\u2713"}</li>
          <li>Total out / total in is less than 20%: {"\u2713"}</li>
          <li><strong>Current balance</strong> is what the wallet still holds at the frozen timestamp.</li>
          <li><strong>Peak balance</strong> is the wallet&apos;s highest recorded balance.</li>
        </ul>
      </section>
      <section className="section">
        <h2>Current / peak</h2>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Current</div><div className="metric-value">{fmtNumber(example.summary.currentBalance)}</div></div>
          <div className="metric"><div className="metric-label">Peak</div><div className="metric-value">{fmtNumber(example.summary.peakBalance)}</div></div>
          <div className="metric"><div className="metric-label">% of peak</div><div className="metric-value">{fmtPct(example.summary.ofPeak * 100)}</div></div>
        </div>
      </section>
      <section className="section">
        <h2>In / out</h2>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Total in</div><div className="metric-value">{fmtNumber(example.summary.totalIn)}</div></div>
          <div className="metric"><div className="metric-label">Total out</div><div className="metric-value">{fmtNumber(example.summary.totalOut)}</div></div>
          <div className="metric"><div className="metric-label">In / out</div><div className="metric-value">{fmtPct(example.summary.soldBought * 100)}</div></div>
        </div>
      </section>
      <section className="section">
        <h2>Avg coin age</h2>
        <ul className="note-list">
          <li>Avg coin age is balance-weighted days held: sum(token amount x days held) / current balance.</li>
          <li>When tokens leave the wallet, their accumulated coin-days are destroyed for this wallet&apos;s age calculation.</li>
        </ul>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Avg coin age</div><div className="metric-value">{fmtNumber(example.summary.avgCoinAgeDays, 1)} days</div></div>
        </div>
      </section>
      <section className="section">
        <h2>Event-by-event replay</h2>
        <ul className="note-list">
          <li>The table stops at the last wallet event; age keeps accumulating until the frozen timestamp, adding about 7 more days.</li>
          <li>Transfers are categorized only as in or out; no further transfer-type labels are applied.</li>
        </ul>
        <div className="table-scroll-shell">
          <TableScrollTip />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Amount</th><th>Days</th><th>Bal before</th><th>Age before</th><th>Bal after</th><th>Age after</th></tr>
              </thead>
              <tbody>
                {example.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.date}</td>
                    <td>{row.type}</td>
                    <td>{fmtNumber(row.amount)}</td>
                    <td>{fmtNumber(row.days, 1)}</td>
                    <td>{fmtNumber(row.balanceBefore)}</td>
                    <td>{fmtNumber(row.ageBefore, 1)}</td>
                    <td>{fmtNumber(row.balanceAfter)}</td>
                    <td>{fmtNumber(row.ageAfter, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
