"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { basescanTokenUrl, fmtNumber, fmtPct } from "@/lib/format";
import type { MetadataBundle, MetricExampleBundle } from "@/lib/types";

async function fetchBundle<T>(name: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return response.json();
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
  if (!example || !metadata) return <main className="page"><div className="status">Loading metric example...</div></main>;

  return (
    <main className="page">
      <p><Link href="/">Back to dashboard</Link></p>
      <section className="section">
        <h2>Example - Chad metrics</h2>
        <p><a href={basescanTokenUrl(metadata.contractAddress, example.wallet)} target="_blank">{example.wallet}</a></p>
        <p><strong>This worked example is time-frozen at {example.asOf.replace("T", " ").replace(":00Z", " UTC")}.</strong></p>
      </section>
      <section className="section">
        <h2>Inclusion criterias</h2>
        <ul className="note-list">
          <li>Current holdings are at least 90% of peak holdings: {"\u2713"}</li>
          <li>Total sold / total bought is less than 20%: {"\u2713"}</li>
          <li><strong>Current balance</strong> is what the wallet still holds at the frozen timestamp.</li>
          <li><strong>Peak balance</strong> is the wallet&apos;s highest recorded balance.</li>
        </ul>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Current</div><div className="metric-value">{fmtNumber(example.summary.currentBalance)}</div></div>
          <div className="metric"><div className="metric-label">Peak</div><div className="metric-value">{fmtNumber(example.summary.peakBalance)}</div></div>
          <div className="metric"><div className="metric-label">% of peak</div><div className="metric-value">{fmtPct(example.summary.ofPeak * 100)}</div></div>
        </div>
      </section>
      <section className="section">
        <h2>Sold / bought</h2>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Total in</div><div className="metric-value">{fmtNumber(example.summary.totalIn)}</div></div>
          <div className="metric"><div className="metric-label">Total out</div><div className="metric-value">{fmtNumber(example.summary.totalOut)}</div></div>
          <div className="metric"><div className="metric-label">Sold / bought</div><div className="metric-value">{fmtPct(example.summary.soldBought * 100)}</div></div>
        </div>
      </section>
      <section className="section">
        <h2>Avg coin age</h2>
        <p>Avg coin age is balance-weighted days held: sum(token amount x days held) / current balance.</p>
        <div className="metric-grid">
          <div className="metric"><div className="metric-label">Avg coin age</div><div className="metric-value">{fmtNumber(example.summary.avgCoinAgeDays, 1)} days</div></div>
        </div>
      </section>
      <section className="section">
        <h2>Event-by-event replay</h2>
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
      </section>
    </main>
  );
}
