"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Data, Layout } from "plotly.js";
import { Plot } from "./Plot";
import { basescanTokenUrl, fmtNumber, fmtPct, fmtUsd, shortAddress } from "@/lib/format";
import type {
  ChadBundle,
  DatasetDetailsBundle,
  HolderBucketsBundle,
  MetadataBundle,
  PriceBundle,
  PriceContextBundle,
  PriceEvent,
  SoulboundBundle,
  WalletVerificationBundle,
} from "@/lib/types";

type DashboardData = {
  metadata: MetadataBundle;
  price: PriceBundle;
  priceContext: PriceContextBundle;
  chad: ChadBundle;
  soulbound: SoulboundBundle;
  holderBuckets: HolderBucketsBundle;
  walletVerification: WalletVerificationBundle;
  datasetDetails: DatasetDetailsBundle;
};

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171"];
const CHAD_COLORS = ["#34d399", "#22d3ee", "#6366f1"];

async function fetchBundle<T>(name: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${name}`);
  if (!response.ok) {
    throw new Error(`Could not load ${name}: ${response.status}`);
  }
  return response.json();
}

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchBundle<MetadataBundle>("metadata"),
      fetchBundle<PriceBundle>("price"),
      fetchBundle<PriceContextBundle>("price-context"),
      fetchBundle<ChadBundle>("chad"),
      fetchBundle<SoulboundBundle>("soulbound"),
      fetchBundle<HolderBucketsBundle>("holder-buckets"),
      fetchBundle<WalletVerificationBundle>("wallet-verification"),
      fetchBundle<DatasetDetailsBundle>("dataset-details"),
    ])
      .then(([metadata, price, priceContext, chad, soulbound, holderBuckets, walletVerification, datasetDetails]) => {
        if (!cancelled) setData({ metadata, price, priceContext, chad, soulbound, holderBuckets, walletVerification, datasetDetails });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load dashboard data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: Array<Record<string, React.ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>{columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressValue({ value }: { value: number }) {
  return (
    <div className="progress-cell">
      <span>{fmtPct(value)}</span>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function nearestPrice(price: PriceBundle, date: string) {
  const target = new Date(date).getTime();
  let best = price.history[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const point of price.history) {
    const delta = Math.abs(new Date(point.date).getTime() - target);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return best?.priceUsd ?? 0;
}

function groupedPriceMarkers(price: PriceBundle, events: PriceEvent[]) {
  const usedMajor = new Set<string>();
  return events.flatMap((event) => {
    if (event.section !== "key") return [];
    if (event.tier === "major") {
      if (usedMajor.has(event.group)) return [];
      usedMajor.add(event.group);
      const groupEvents = events.filter((candidate) => candidate.group === event.group && candidate.section === "key");
      const anchor = groupEvents.sort((a, b) => (a.time_utc || a.date).localeCompare(b.time_utc || b.date))[0];
      const date = anchor.chart_date || anchor.date;
      return [{ date, y: nearestPrice(price, date), tier: "major", label: event.group }];
    }
    const date = event.chart_date || event.date;
    return [{ date, y: nearestPrice(price, date), tier: event.tier, label: event.title }];
  });
}

function PriceStory({ price, context }: { price: PriceBundle; context: PriceContextBundle }) {
  const [mode, setMode] = useState<"Off" | "Key events" | "Bonus lore">("Key events");
  const markers = useMemo(() => groupedPriceMarkers(price, context.events), [price, context.events]);
  const major = markers.filter((marker) => marker.tier === "major");
  const other = markers.filter((marker) => marker.tier !== "major");

  const data: Data[] = [
    {
      x: price.history.map((p) => p.date),
      y: price.history.map((p) => p.priceUsd),
      type: "scatter",
      mode: "lines",
      name: "Price",
      line: { color: "#22d3ee", width: 2 },
      hovertemplate: "%{x|%b %d, %Y}<br>$%{y:.6f}<extra>TIBBIR</extra>",
    },
  ];

  if (mode === "Key events") {
    data.push(
      {
        x: major.map((m) => m.date),
        y: major.map((m) => m.y),
        text: major.map((m) => m.label),
        type: "scatter",
        mode: "markers",
        name: "Major events",
        marker: { color: "#34d399", size: 20 },
        hovertemplate: "%{x|%b %d, %Y}<br><b>%{text}</b><extra></extra>",
      },
      {
        x: other.map((m) => m.date),
        y: other.map((m) => m.y),
        text: other.map((m) => m.label),
        type: "scatter",
        mode: "markers",
        name: "Other",
        marker: { color: "#fbbf24", size: 15 },
        hovertemplate: "%{x|%b %d, %Y}<br><b>%{text}</b><extra></extra>",
      },
    );
  }

  return (
    <section className="section">
      <h2>Price, key events & bonus lore</h2>
      <div className="link-row" aria-label="Price context">
        {(["Off", "Key events", "Bonus lore"] as const).map((option) => (
          <button className={`radio-button ${mode === option ? "active" : ""}`} key={option} onClick={() => setMode(option)}>
            {option}
          </button>
        ))}
      </div>
      <div className="metric-grid">
        <Metric label="Latest daily price" value={fmtUsd(price.latest?.priceUsd)} />
      </div>
      <Plot
        data={data}
        layout={{
          height: 400,
          yaxis: { tickprefix: "$", tickformat: ".2f" } as Partial<Layout["yaxis"]>,
        }}
      />
      {mode !== "Off" && <PriceContextDetails mode={mode} context={context} />}
    </section>
  );
}

function PriceContextDetails({ mode, context }: { mode: "Key events" | "Bonus lore"; context: PriceContextBundle }) {
  const events = context.events.filter((event) => event.section === (mode === "Key events" ? "key" : "lore"));
  const majorGroups = Array.from(new Set(events.filter((event) => event.tier === "major").map((event) => event.group)));
  return (
    <details className="details">
      <summary>Price context details</summary>
      <div className="details-body">
        {mode === "Key events" ? (
          <>
            {majorGroups.map((group) => {
              const groupEvents = events.filter((event) => event.group === group);
              const titleDate = groupEvents[0]?.date;
              return (
                <div className="timeline-item" key={group}>
                  <strong>{titleDate} - {group}</strong>
                  <ul>
                    {groupEvents.map((event) => (
                      <li key={`${event.title}-${event.time_utc}`}>
                        {event.time_utc || event.date} - {event.title} {event.links?.map((link) => <a key={link.url} href={link.url} target="_blank"> {link.label}</a>)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {events.filter((event) => event.tier !== "major").map((event) => (
              <div className="timeline-item" key={event.title}>
                <strong>{event.date}</strong> - {event.title} {event.links?.map((link) => <a key={link.url} href={link.url} target="_blank"> {link.label}</a>)}
              </div>
            ))}
          </>
        ) : (
          <>
            {context.zones.map((zone) => (
              <div className="timeline-item" key={zone.title}>
                <strong>{zone.title}</strong>
                {zone.detail && <p>{zone.detail}</p>}
                {zone.links?.map((link) => <p key={link.url}><a href={link.url} target="_blank">{link.label}</a></p>)}
              </div>
            ))}
            {["Beeple x Tibbir", "Konami", "Other / Misc"].map((group) => {
              const groupEvents = events.filter((event) => event.group === group);
              if (!groupEvents.length) return null;
              return (
                <div className="timeline-item" key={group}>
                  <strong>{group}</strong>
                  <ul>
                    {groupEvents.map((event) => <li key={event.title}>{event.links?.[0] ? <a href={event.links[0].url} target="_blank">{event.title}</a> : event.title}</li>)}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </details>
  );
}

function ChadWallets({ chad, contract }: { chad: ChadBundle; contract: string }) {
  const cohortOrder = ["10k-100k", "100k-1M", "1M+"];
  const data: Data[] = cohortOrder.map((cohort, idx) => {
    const rows = chad.cohorts.filter((row) => row.cohort === cohort);
    return {
      x: rows.map((row) => row.date as string),
      y: rows.map((row) => Number(row.balance)),
      type: "scatter",
      mode: "lines",
      stackgroup: "one",
      name: cohort,
      line: { color: CHAD_COLORS[idx], width: 0.5 },
      fillcolor: CHAD_COLORS[idx],
      hovertemplate: "%{y:,.0f} TIBBIR<extra>" + cohort + "</extra>",
    };
  });

  return (
    <section className="section" id="chad-wallets">
      <h2>Chad wallets</h2>
      <div className="note-list">
        <strong>Inclusion criteria for wallets</strong><br />
        - current holdings are at least 90% of peak holdings<br />
        - total sold / total bought is less than 20%
      </div>
      <div className="metric-grid">
        <Metric label="Chad wallets" value={fmtNumber(chad.summary.wallets)} />
        <Metric label="TIBBIR held" value={fmtNumber(chad.summary.tibbirHeld)} />
        <Metric label="Avg coin age" value={`${fmtNumber(chad.summary.avgCoinAgeDays)} days`} />
      </div>
      <Plot data={data} layout={{ height: 400 }} />
      <p className="caption">Historical holdings are grouped by each wallet&apos;s current cohort.</p>
      <ChadSummaryTable chad={chad} />
      <details className="details">
        <summary>Example and wallet verification</summary>
        <div className="details-body">
          <p><a href="/example-chad-metrics">Example - Chad metrics</a></p>
          <WalletSearchTable
            rows={chad.wallets}
            contract={contract}
            columns={["Wallet", "BaseScan", "Current", "Peak", "% of peak", "Sold / bought", "Age"]}
            rowMapper={(row) => ({
              Wallet: shortAddress(String(row.wallet_address)),
              BaseScan: <a href={basescanTokenUrl(contract, String(row.wallet_address))} target="_blank">open</a>,
              Current: fmtNumber(Number(row.current_balance)),
              Peak: fmtNumber(Number(row.peak_balance)),
              "% of peak": fmtPct(Number(row.retention_ratio) * 100),
              "Sold / bought": fmtPct(Number(row.turnover_ratio) * 100),
              Age: `${fmtNumber(Number(row.avg_coin_age_days))}d`,
            })}
            searchKey="wallet_address"
          />
        </div>
      </details>
    </section>
  );
}

function ChadSummaryTable({ chad }: { chad: ChadBundle }) {
  const latest = new Map<string, Record<string, number | string>>();
  for (const row of chad.cohorts) latest.set(String(row.cohort), row);
  const rows = ["10k-100k", "100k-1M", "1M+"].map((cohort) => {
    const row = latest.get(cohort) || {};
    return {
      Cohort: cohort,
      Wallets: fmtNumber(Number(row.wallet_count || 0)),
      "TIBBIR held": fmtNumber(Number(row.total_balance || 0)),
      "Avg coin age": `${fmtNumber(Number(row.avg_coin_age_days || 0))} days`,
      "% of peak": fmtPct(Number(row.avg_retention_ratio || 0) * 100),
      "Sold / bought": fmtPct(Number(row.avg_turnover_ratio || 0) * 100),
    };
  });
  return <Table columns={["Cohort", "Wallets", "TIBBIR held", "Avg coin age", "% of peak", "Sold / bought"]} rows={rows} />;
}

function SoulboundWallets({ soulbound, contract }: { soulbound: SoulboundBundle; contract: string }) {
  const data: Data[] = [{
    x: soulbound.history.map((row) => row.date as string),
    y: soulbound.history.map((row) => Number(row.total_balance)),
    type: "scatter",
    mode: "lines",
    name: "Soulbound wallets",
    line: { color: "#34d399", width: 2 },
    fill: "tozeroy",
    fillcolor: "rgba(52,211,153,0.28)",
    customdata: soulbound.history.map((row) => Number(row.pct_total_supply)),
    hovertemplate: "%{x|%b %d, %Y}<br>%{customdata:.2f}% of supply<extra>Soulbound wallets</extra>",
  }];
  const summary = soulbound.summary || {};
  return (
    <section className="section" id="soulbound-wallets">
      <h2>Soulbound wallets</h2>
      <div className="metric-grid">
        <Metric label="TIBBIR held" value={fmtNumber(Number(summary.total_balance || 0))} />
        <Metric label="Share of supply" value={fmtPct(Number(summary.pct_total_supply || 0), 2)} />
        <Metric label="TIBBIR holders" value={`${fmtNumber(Number(summary.holder_count || 0))} / ${fmtNumber(Number(summary.soulbound_address_count || 0))}`} />
      </div>
      <Plot data={data} layout={{ height: 400, showlegend: false }} />
      <p className="caption">Current TIBBIR held by addresses with a soulbound NFT.</p>
      <details className="details">
        <summary>Wallet verification</summary>
        <div className="details-body">
          <p><a href={soulbound.holdersUrl} target="_blank">View all soulbound NFT holders on BaseScan</a></p>
          <WalletSearchTable
            rows={soulbound.wallets}
            contract={contract}
            columns={["Wallet", "BaseScan", "TIBBIR held", "Soulbound NFTs"]}
            rowMapper={(row) => ({
              Wallet: shortAddress(String(row.address)),
              BaseScan: <a href={basescanTokenUrl(contract, String(row.address))} target="_blank">open</a>,
              "TIBBIR held": fmtNumber(Number(row.balance)),
              "Soulbound NFTs": fmtNumber(Number(row.nft_quantity)),
            })}
            searchKey="address"
          />
        </div>
      </details>
    </section>
  );
}

function HolderBuckets({ holderBuckets }: { holderBuckets: HolderBucketsBundle }) {
  const labels = holderBuckets.buckets.map((bucket) => bucket.label);
  const currentWalletData: Data[] = [{
    x: labels,
    y: holderBuckets.latest.map((row) => row.wallets),
    type: "bar",
    marker: { color: COLORS },
    text: holderBuckets.latest.map((row) => fmtNumber(row.wallets)),
    textposition: "outside",
    hovertemplate: "%{x}<br>%{y:,} wallets<extra></extra>",
  }];
  const walletHistory: Data[] = holderBuckets.buckets.map((bucket, idx) => ({
    x: holderBuckets.walletCountHistory.map((row) => row.date as string),
    y: holderBuckets.walletCountHistory.map((row) => Number(row[bucket.countColumn] || 0)),
    type: "scatter",
    mode: "lines",
    stackgroup: "one",
    name: bucket.label,
    line: { color: COLORS[idx], width: 0.5 },
    fillcolor: COLORS[idx],
  }));
  const currentDistribution: Data[] = [{
    x: labels,
    y: holderBuckets.latest.map((row) => row.supplySharePct),
    type: "bar",
    marker: { color: COLORS },
    text: holderBuckets.latest.map((row) => fmtPct(row.supplySharePct)),
    textposition: "outside",
    hovertemplate: "%{x}<br>%{y:.1f}% of supply<extra></extra>",
  }];
  const distributionHistory: Data[] = holderBuckets.buckets.map((bucket, idx) => ({
    x: holderBuckets.holderDistributionHistory.map((row) => row.date as string),
    y: holderBuckets.holderDistributionHistory.map((row) => Number(row[bucket.pctColumn] || 0)),
    type: "scatter",
    mode: "lines",
    stackgroup: "one",
    name: bucket.label,
    line: { color: COLORS[idx], width: 0.5 },
    fillcolor: COLORS[idx],
  }));

  return (
    <>
      <section className="section" id="current-wallet-count">
        <h2>Current wallet count per bucket</h2>
        <div className="metric-grid"><Metric label="Wallet count" value={fmtNumber(holderBuckets.totalWallets)} /></div>
        <Plot data={currentWalletData} layout={{ height: 280, showlegend: false }} className="compact-chart" />
        <p className="caption">Addresses with a current TIBBIR balance, grouped by wallet size.</p>
      </section>
      <section className="section" id="wallet-count-history">
        <h2>Wallet count history</h2>
        <Plot data={walletHistory} layout={{ height: 400 }} />
      </section>
      <section className="section" id="current-holder-distribution">
        <h2>Current holder distribution</h2>
        <Plot data={currentDistribution} layout={{ height: 280, showlegend: false, yaxis: { ticksuffix: "%", range: [0, 100] } as Partial<Layout["yaxis"]> }} className="compact-chart" />
        <p className="caption">Share of current TIBBIR supply held by wallets in each balance bucket.</p>
      </section>
      <section className="section" id="holder-distribution-history">
        <h2>Holder distribution history</h2>
        <Plot data={distributionHistory} layout={{ height: 400, yaxis: { range: [0, 100] } as Partial<Layout["yaxis"]> }} />
      </section>
      <section className="section" id="wallets-vs-supply">
        <h2>Wallets vs supply by bucket</h2>
        <Table
          columns={["Bucket", "Wallets", "% of wallets", "% of supply"]}
          rows={holderBuckets.latest.map((row) => ({
            Bucket: row.bucket,
            Wallets: fmtNumber(row.wallets),
            "% of wallets": <ProgressValue value={row.walletSharePct} />,
            "% of supply": <ProgressValue value={row.supplySharePct} />,
          }))}
        />
        <p className="caption">Current wallet count and supply share shown side by side for each balance bucket.</p>
      </section>
    </>
  );
}

function WalletSearchTable<T extends Record<string, unknown>>({
  rows,
  columns,
  rowMapper,
  searchKey,
}: {
  rows: T[];
  contract: string;
  columns: string[];
  rowMapper: (row: T) => Record<string, React.ReactNode>;
  searchKey: keyof T;
}) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) => String(row[searchKey] || "").toLowerCase().includes(query.toLowerCase())).slice(0, 500);
  return (
    <>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wallet" />
      <Table columns={columns} rows={filtered.map(rowMapper)} />
    </>
  );
}

function ExploreLinks() {
  const links = [
    ["Chad wallets", "#chad-wallets"],
    ["Soulbound wallets", "#soulbound-wallets"],
    ["Current wallet count", "#current-wallet-count"],
    ["Wallet count history", "#wallet-count-history"],
    ["Current holder distribution", "#current-holder-distribution"],
    ["Holder distribution history", "#holder-distribution-history"],
    ["Wallets vs supply", "#wallets-vs-supply"],
  ];
  return (
    <nav className="explore">
      <div className="explore-title">Explore more</div>
      <div className="link-row">{links.map(([label, href]) => <a className="pill-link" href={href} key={href}>{label}</a>)}</div>
    </nav>
  );
}

export function DashboardApp() {
  const { data, error } = useDashboardData();
  if (error) return <main className="page"><div className="status">{error}</div></main>;
  if (!data) return <main className="page"><div className="status">Loading dashboard data...</div></main>;

  const meta = data.metadata.metadata;
  return (
    <main className="page">
      <header className="brand">
        <h1>tibson analytics</h1>
        <Image src="/tibson.avif" alt="tibson" width={88} height={88} priority />
      </header>
      <section className="section">
        <div className="metric-grid">
          <Metric label="Last updated" value={String(meta.last_updated_utc || "-").replace("T", " ").slice(0, 16) + " UTC"} />
          <Metric label="Latest block" value={fmtNumber(Number(meta.end_block || 0))} />
        </div>
        <ul className="note-list">
          <li>Transaction data updates ~hourly</li>
          <li>Price data updates daily</li>
        </ul>
        <p><a href="/dataset-details">Read more details about data coverage</a></p>
      </section>
      <PriceStory price={data.price} context={data.priceContext} />
      <ExploreLinks />
      <ChadWallets chad={data.chad} contract={data.metadata.contractAddress} />
      <SoulboundWallets soulbound={data.soulbound} contract={data.metadata.contractAddress} />
      <HolderBuckets holderBuckets={data.holderBuckets} />
    </main>
  );
}
