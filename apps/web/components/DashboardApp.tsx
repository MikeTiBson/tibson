"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Data, Layout } from "plotly.js";
import { Plot } from "./Plot";
import { basescanTokenUrl, fmtNumber, fmtPct, shortAddress } from "@/lib/format";
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

type DashboardView = "price" | "chad" | "soulbound" | "wallet-count" | "holder-distribution" | "wallets-vs-supply";

const COLORS = ["#a7df00", "#f0a72a", "#c87316", "#8d3f08", "#e85d2a"];
const CHAD_COLORS = ["#a7df00", "#f0a72a", "#c87316"];
const VIEW_OPTIONS: Array<{ id: DashboardView; label: string }> = [
  { id: "price", label: "Price" },
  { id: "chad", label: "Chad wallets" },
  { id: "soulbound", label: "Soulbound wallets" },
  { id: "wallet-count", label: "Wallet count" },
  { id: "holder-distribution", label: "Holder distribution" },
  { id: "wallets-vs-supply", label: "Wallets vs supply" },
];

async function fetchBundle<T>(name: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${name}`);
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error ? ` - ${body.error}` : "";
    } catch {
      // Keep the compact status-only message if the API did not return JSON.
    }
    throw new Error(`Could not load ${name}: ${response.status}${detail}`);
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

function ChartNavigation({ activeView, onChange }: { activeView: DashboardView; onChange: (view: DashboardView) => void }) {
  return (
    <nav className="view-nav" aria-label="Dashboard views">
      <div className="view-tabs" role="tablist">
        {VIEW_OPTIONS.map((view) => (
          <button
            aria-selected={activeView === view.id}
            className={`tab-button view-tab ${activeView === view.id ? "active" : ""}`}
            key={view.id}
            onClick={() => onChange(view.id)}
            role="tab"
            type="button"
          >
            {view.label}
          </button>
        ))}
      </div>
    </nav>
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
      line: { color: "#a7df00", width: 2 },
      hovertemplate: "%{x|%b %d, %Y}<br>$%{y:.6f}<extra></extra>",
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
        marker: { color: "#18ff00", line: { color: "#1f241a", width: 4 }, size: 20 },
        hovertemplate: "%{x|%b %d, %Y}<br><b>%{text}</b><extra></extra>",
      },
      {
        x: other.map((m) => m.date),
        y: other.map((m) => m.y),
        text: other.map((m) => m.label),
        type: "scatter",
        mode: "markers",
        name: "Other",
        marker: { color: "#31ff8f", size: 15 },
        hovertemplate: "%{x|%b %d, %Y}<br><b>%{text}</b><extra></extra>",
      },
    );
  }

  return (
    <section className="section">
      <h2>Price, key events & bonus lore</h2>
      <div className="radio-group" aria-label="Price context">
        {(["Off", "Key events", "Bonus lore"] as const).map((option) => (
          <label className={`radio-button ${mode === option ? "active" : ""}`} key={option}>
            <input
              checked={mode === option}
              name="price-context"
              onChange={() => setMode(option)}
              type="radio"
              value={option}
            />
            {option}
          </label>
        ))}
      </div>
      <Plot
        data={data}
        layout={{
          annotations: mode === "Bonus lore" ? [{
            font: { color: "#f0a72a", size: 12 },
            showarrow: false,
            text: "<b>No dates zone</b>",
            x: "2025-06-22",
            xanchor: "left",
            xref: "x",
            y: 1,
            yanchor: "top",
            yref: "paper",
          }] : [],
          height: 400,
          images: mode === "Key events" ? major.map((marker) => ({
            layer: "above",
            opacity: 1,
            sizex: 1000 * 60 * 60 * 24 * 14,
            sizey: 0.035,
            sizing: "contain",
            source: "/ribbit-coin.png",
            x: marker.date,
            xanchor: "center",
            xref: "x",
            y: marker.y,
            yanchor: "middle",
            yref: "y",
          })) : [],
          shapes: mode === "Bonus lore" ? [{
            fillcolor: "rgba(33, 24, 13, 0.58)",
            layer: "below",
            line: { width: 0 },
            type: "rect",
            x0: "2025-06-22",
            x1: "2025-11-11",
            xref: "x",
            y0: 0,
            y1: 1,
            yref: "paper",
          }] : [],
          showlegend: false,
          yaxis: { tickprefix: "$", tickformat: ".2f" } as Partial<Layout["yaxis"]>,
        }}
      />
      <div className="chart-legend" aria-label="Price chart legend">
        <span className="legend-item"><span className="legend-line" />Price</span>
        {mode === "Key events" && (
          <>
            <span className="legend-item"><Image alt="" className="legend-icon" src="/ribbit-coin.png" width={18} height={18} />Major events</span>
            <span className="legend-item"><span className="legend-dot legend-dot-other" />Other</span>
          </>
        )}
      </div>
      {mode !== "Off" && <PriceContextDetails mode={mode} context={context} />}
    </section>
  );
}

function PriceContextDetails({ mode, context }: { mode: "Key events" | "Bonus lore"; context: PriceContextBundle }) {
  const events = context.events.filter((event) => event.section === (mode === "Key events" ? "key" : "lore"));
  const eventSortKey = (event: PriceEvent) => `${event.date} ${event.time_utc || ""}`;
  const renderLinkList = (links: PriceEvent["links"]) => {
    if (!links?.length) return null;
    return <ul>{links.map((link) => <li key={link.url}><a href={link.url} target="_blank">{link.label}</a></li>)}</ul>;
  };
  const majorGroups = Array.from(new Set(events.filter((event) => event.tier === "major").map((event) => event.group)))
    .map((group) => {
      const groupEvents = events
        .filter((event) => event.group === group)
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
      return { group, groupEvents, sortKey: eventSortKey(groupEvents[0]) };
    });
  const keyTimeline = [
    ...majorGroups.map((entry) => ({ type: "major" as const, sortKey: entry.sortKey, entry })),
    ...events
      .filter((event) => event.tier !== "major")
      .map((event) => ({ type: "event" as const, sortKey: eventSortKey(event), event })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <details className="details">
      <summary>Price context details</summary>
      <div className="details-body">
        {mode === "Key events" ? (
          <>
            {keyTimeline.map((item) => {
              if (item.type === "event") {
                const event = item.event;
                return (
                  <div className="timeline-item" key={event.title}>
                    <strong>{event.date} - {event.title}</strong>
                    {renderLinkList(event.links)}
                  </div>
                );
              }

              const { group, groupEvents } = item.entry;
              const titleDate = groupEvents[0]?.date;
              return (
                <div className="timeline-item" key={group}>
                  <strong>{titleDate} - {group}</strong>
                  {groupEvents.length === 1 ? (
                    renderLinkList(groupEvents[0].links)
                  ) : (
                    <ul>
                      {groupEvents.map((event) => (
                        <li key={`${event.title}-${event.time_utc || event.date}`}>
                          {event.time_utc || event.date} | {event.links?.[0] ? (
                            <a href={event.links[0].url} target="_blank">{event.title}</a>
                          ) : event.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {context.zones.map((zone) => (
              <div className="timeline-item" key={zone.title}>
                <strong>{zone.title}</strong>
                {zone.detail && <p>{zone.detail}</p>}
                {zone.links?.length ? (
                  <ul>
                    {zone.links.map((link) => <li key={link.url}><a href={link.url} target="_blank">{link.label}</a></li>)}
                  </ul>
                ) : null}
              </div>
            ))}
            {["Beeple x Tibbir", "Konami", "Other / Misc"].map((group) => {
              const groupEvents = events
                .filter((event) => event.group === group)
                .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)) || a.title.localeCompare(b.title));
              if (!groupEvents.length) return null;
              return (
                <div className="timeline-item" key={group}>
                  <strong>{group}</strong>
                  <ul>
                    {group === "Konami" ? (
                      groupEvents.flatMap((event) => event.links || []).map((link) => (
                        <li key={link.url}><a href={link.url} target="_blank">{link.label}</a></li>
                      ))
                    ) : (
                      groupEvents.map((event) => <li key={event.title}>{event.links?.[0] ? <a href={event.links[0].url} target="_blank">{event.title}</a> : event.title}</li>)
                    )}
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
    line: { color: "#a7df00", width: 2 },
    fill: "tozeroy",
    fillcolor: "rgba(167,223,0,0.24)",
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

function HolderBuckets({ holderBuckets, view }: { holderBuckets: HolderBucketsBundle; view: Extract<DashboardView, "wallet-count" | "holder-distribution" | "wallets-vs-supply"> }) {
  const labels = holderBuckets.buckets.map((bucket) => bucket.label);
  const latestByBucket = new Map(holderBuckets.latest.map((row) => [row.bucket, row]));
  const currentWalletData: Data[] = [{
    x: labels,
    y: labels.map((label) => latestByBucket.get(label)?.wallets ?? 0),
    type: "bar",
    marker: { color: COLORS },
    text: labels.map((label) => fmtNumber(latestByBucket.get(label)?.wallets ?? 0)),
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
    y: labels.map((label) => latestByBucket.get(label)?.supplySharePct ?? 0),
    type: "bar",
    marker: { color: COLORS },
    text: labels.map((label) => fmtPct(latestByBucket.get(label)?.supplySharePct ?? 0)),
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

  if (view === "wallet-count") {
    return (
      <section className="section" id="wallet-count">
        <h2>Wallet count</h2>
        <div className="metric-grid"><Metric label="Wallet count" value={fmtNumber(holderBuckets.totalWallets)} /></div>
        <Plot data={currentWalletData} layout={{ height: 280, showlegend: false, xaxis: { type: "category" } as Partial<Layout["xaxis"]> }} className="compact-chart" />
        <p className="caption">Addresses with a current TIBBIR balance, grouped by wallet size.</p>
        <h3>History</h3>
        <Plot data={walletHistory} layout={{ height: 400 }} />
      </section>
    );
  }

  if (view === "holder-distribution") {
    return (
      <section className="section" id="holder-distribution">
        <h2>Holder distribution</h2>
        <Plot
          data={currentDistribution}
          layout={{
            height: 280,
            showlegend: false,
            xaxis: { type: "category" } as Partial<Layout["xaxis"]>,
            yaxis: { ticksuffix: "%", range: [0, 100] } as Partial<Layout["yaxis"]>,
          }}
          className="compact-chart"
        />
        <p className="caption">Share of current TIBBIR supply held by wallets in each balance bucket.</p>
        <h3>History</h3>
        <Plot data={distributionHistory} layout={{ height: 400, yaxis: { range: [0, 100] } as Partial<Layout["yaxis"]> }} />
      </section>
    );
  }

  return (
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

export function DashboardApp() {
  const { data, error } = useDashboardData();
  const [activeView, setActiveView] = useState<DashboardView>("price");
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
      <ChartNavigation activeView={activeView} onChange={setActiveView} />
      {activeView === "price" && <PriceStory price={data.price} context={data.priceContext} />}
      {activeView === "chad" && <ChadWallets chad={data.chad} contract={data.metadata.contractAddress} />}
      {activeView === "soulbound" && <SoulboundWallets soulbound={data.soulbound} contract={data.metadata.contractAddress} />}
      {(activeView === "wallet-count" || activeView === "holder-distribution" || activeView === "wallets-vs-supply") && (
        <HolderBuckets holderBuckets={data.holderBuckets} view={activeView} />
      )}
    </main>
  );
}
