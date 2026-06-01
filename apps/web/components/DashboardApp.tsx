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

const BUCKET_COLORS: Record<string, string> = {
  "1M+": "#5c5345",
  "100k-1M": "#746a58",
  "10k-100k": "#8c806a",
  "1k-10k": "#a29780",
  "0-1k": "#b2a88f",
};
const BUCKET_FILL_COLORS: Record<string, string> = {
  "1M+": "rgba(92, 83, 69, 0.82)",
  "100k-1M": "rgba(116, 106, 88, 0.78)",
  "10k-100k": "rgba(140, 128, 106, 0.74)",
  "1k-10k": "rgba(162, 151, 128, 0.70)",
  "0-1k": "rgba(178, 168, 143, 0.66)",
};
const CHAD_COLORS = [BUCKET_COLORS["10k-100k"], BUCKET_COLORS["100k-1M"], BUCKET_COLORS["1M+"]];
const VIEW_OPTIONS: Array<{ id: DashboardView; label: string }> = [
  { id: "price", label: "Price & context" },
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

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [breakpoint]);

  return isMobile;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function bucketColor(label: string) {
  return BUCKET_COLORS[label] || "#fff7e8";
}

function bucketFillColor(label: string) {
  return BUCKET_FILL_COLORS[label] || "rgba(255, 247, 232, 0.5)";
}

function Table({ columns, rows }: { columns: string[]; rows: Array<Record<string, React.ReactNode>> }) {
  return (
    <div className="table-scroll-shell">
      <span
        aria-label="This table scrolls sideways on small screens."
        className="table-scroll-tip"
        data-tooltip="This table scrolls sideways on small screens."
        role="img"
        tabIndex={0}
      >
        i
      </span>
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

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="chart-note">
      <span
        aria-label={text.replace(/^- /, "")}
        className="info-tip"
        data-tooltip={text}
        role="img"
        tabIndex={0}
      >
        i
      </span>
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
  const isMobile = useIsMobile();
  const markers = useMemo(() => groupedPriceMarkers(price, context.events), [price, context.events]);
  const major = markers.filter((marker) => marker.tier === "major");
  const other = markers.filter((marker) => marker.tier !== "major");
  const majorCoinSize = isMobile
    ? { x: 1000 * 60 * 60 * 24 * 30, y: 0.075 }
    : { x: 1000 * 60 * 60 * 24 * 14, y: 0.035 };

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
        marker: {
          color: "rgba(0,0,0,0)",
          line: { color: "rgba(0,0,0,0)", width: 0 },
          opacity: 0,
          size: 20,
        },
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
      <h2>Price & context</h2>
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
          height: isMobile ? 320 : 400,
          images: mode === "Key events" ? major.map((marker) => ({
            layer: "above",
            opacity: 1,
            sizex: majorCoinSize.x,
            sizey: majorCoinSize.y,
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
        <p className="details-note">
          {mode === "Key events"
            ? "Selected context only; this timeline does not cover every TIBBIR-related event."
            : "Selected bonus lore only; this list does not try to capture every community reference."}
        </p>
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
                        <li className="timeline-row" key={`${event.title}-${event.time_utc || event.date}`}>
                          <span className="timeline-row-content">
                            <span className="timeline-time">{event.time_utc || event.date}</span>
                            <span className="timeline-title">
                              {event.links?.[0] ? (
                                <a href={event.links[0].url} target="_blank">{event.title}</a>
                              ) : event.title}
                            </span>
                          </span>
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

function ChadWallets({ chad, contract, circulatingSupply }: { chad: ChadBundle; contract: string; circulatingSupply: number }) {
  const cohortOrder = ["1M+", "100k-1M", "10k-100k"];
  const [activeCohort, setActiveCohort] = useState(cohortOrder[0]);
  const data: Data[] = cohortOrder.map((cohort, idx) => {
    const rows = chad.cohorts.filter((row) => row.cohort === cohort);
    return {
      x: rows.map((row) => row.date as string),
      y: rows.map((row) => Number(row.balance) / 1_000_000),
      type: "scatter",
      mode: "lines",
      stackgroup: "one",
      name: cohort,
      line: { color: CHAD_COLORS[idx], width: 1 },
      fillcolor: bucketFillColor(cohort),
      hovertemplate: "%{y:,.2f}M<extra>" + cohort + "</extra>",
    };
  });
  const supplyShare = circulatingSupply > 0 ? (chad.summary.tibbirHeld / circulatingSupply) * 100 : 0;

  return (
    <section className="section" id="chad-wallets">
      <h2>Chad wallets</h2>
      <div className="note-list">
        <strong>Inclusion criteria for wallets</strong><br />
        - current holdings are at least 90% of peak holdings<br />
        - total sold / total bought is less than 20%
      </div>
      <div className="metric-grid chad-metric-grid">
        <Metric label="Chad wallets" value={fmtNumber(chad.summary.wallets)} />
        <Metric label="TIBBIR held" value={fmtNumber(chad.summary.tibbirHeld)} />
        <Metric label="Share of supply" value={fmtPct(supplyShare, 2)} />
        <Metric label="Avg coin age" value={`${fmtNumber(chad.summary.avgCoinAgeDays)} days`} />
      </div>
      <InfoTooltip text={"- Wallets qualify based on their current status; their past holdings are then shown over time.\n- Historical holdings are grouped by each wallet's current cohort.\n- Supply share uses circulating supply, excluding burned and dead-address TIBBIR."} />
      <Plot data={data} layout={{ height: 400, hovermode: "x unified", yaxis: { ticksuffix: "M" } }} />
      <ChadSummaryTable chad={chad} circulatingSupply={circulatingSupply} />
      <details className="details">
        <summary>Example and wallet verification</summary>
        <div className="details-body">
          <p><a href="/example-chad-metrics">Example - Chad metrics</a></p>
          <h3>Wallets</h3>
          <div className="view-tabs compact-tabs" role="tablist" aria-label="Chad wallet cohorts">
            {cohortOrder.map((cohort) => (
              <button
                aria-selected={activeCohort === cohort}
                className={`tab-button ${activeCohort === cohort ? "active" : ""}`}
                key={cohort}
                onClick={() => setActiveCohort(cohort)}
                role="tab"
                type="button"
              >
                {cohort}
              </button>
            ))}
          </div>
          <WalletSearchTable
            rows={chad.wallets.filter((row) => String(row.cohort) === activeCohort)}
            contract={contract}
            columns={["Wallet", "BaseScan", "Current / peak", "% of peak", "Sold / bought", "Avg coin age"]}
            rowMapper={(row) => ({
              Wallet: shortAddress(String(row.wallet_address)),
              BaseScan: <a href={basescanTokenUrl(contract, String(row.wallet_address))} target="_blank">open</a>,
              "Current / peak": `${fmtNumber(Number(row.current_balance))} / ${fmtNumber(Number(row.peak_balance))}`,
              "% of peak": fmtPct(Number(row.retention_ratio) * 100),
              "Sold / bought": fmtPct(Number(row.turnover_ratio) * 100),
              "Avg coin age": `${fmtNumber(Number(row.avg_coin_age_days))}d`,
            })}
            searchKey="wallet_address"
          />
        </div>
      </details>
    </section>
  );
}

function ChadSummaryTable({ chad, circulatingSupply }: { chad: ChadBundle; circulatingSupply: number }) {
  const latest = new Map<string, Record<string, number | string>>();
  for (const row of chad.cohorts) latest.set(String(row.cohort), row);
  const rows = ["10k-100k", "100k-1M", "1M+"].map((cohort) => {
    const row = latest.get(cohort) || {};
    const totalBalance = Number(row.total_balance || 0);
    return {
      Cohort: cohort,
      Wallets: fmtNumber(Number(row.wallet_count || 0)),
      "TIBBIR held": fmtNumber(totalBalance),
      "% of supply": fmtPct(circulatingSupply > 0 ? (totalBalance / circulatingSupply) * 100 : 0, 2),
      "Avg coin age": `${fmtNumber(Number(row.avg_coin_age_days || 0))} days`,
      "% of peak": fmtPct(Number(row.avg_retention_ratio || 0) * 100),
      "Sold / bought": fmtPct(Number(row.avg_turnover_ratio || 0) * 100),
    };
  });
  return <Table columns={["Cohort", "Wallets", "TIBBIR held", "% of supply", "Avg coin age", "% of peak", "Sold / bought"]} rows={rows} />;
}

function SoulboundWallets({ soulbound, contract, circulatingSupply }: { soulbound: SoulboundBundle; contract: string; circulatingSupply: number }) {
  const data: Data[] = [{
    x: soulbound.history.map((row) => row.date as string),
    y: soulbound.history.map((row) => Number(row.total_balance)),
    type: "scatter",
    mode: "lines",
    name: "Soulbound wallets",
    line: { color: "#a7df00", width: 2 },
    fill: "tozeroy",
    fillcolor: "rgba(167,223,0,0.24)",
    customdata: soulbound.history.map((row) => circulatingSupply > 0 ? (Number(row.total_balance) / circulatingSupply) * 100 : 0),
    hovertemplate: "%{x|%b %d, %Y}<br>%{customdata:.2f}% of circulating supply<extra>Soulbound wallets</extra>",
  }];
  const summary = soulbound.summary || {};
  const supplyShare = circulatingSupply > 0 ? (Number(summary.total_balance || 0) / circulatingSupply) * 100 : 0;
  return (
    <section className="section" id="soulbound-wallets">
      <h2>Soulbound wallets</h2>
      <div className="metric-grid soulbound-metric-grid">
        <Metric label="TIBBIR held" value={fmtNumber(Number(summary.total_balance || 0))} />
        <Metric label="Share of supply" value={fmtPct(supplyShare, 2)} />
        <Metric label="TIBBIR holders" value={`${fmtNumber(Number(summary.holder_count || 0))} / ${fmtNumber(Number(summary.soulbound_address_count || 0))}`} />
      </div>
      <InfoTooltip text="- The chart tracks current and historical TIBBIR balances for wallets holding a soulbound NFT." />
      <Plot data={data} layout={{ height: 400, hovermode: "x unified", showlegend: false }} />
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
  const [visibleBuckets, setVisibleBuckets] = useState(() => new Set(labels));
  const activeBuckets = holderBuckets.buckets.filter((bucket) => visibleBuckets.has(bucket.label));
  const activeLabels = activeBuckets.map((bucket) => bucket.label);
  const latestByBucket = new Map(holderBuckets.latest.map((row) => [row.bucket, row]));
  const visibleWalletCount = activeLabels.reduce((total, label) => total + (latestByBucket.get(label)?.wallets ?? 0), 0);
  const toggleBucket = (label: string) => {
    setVisibleBuckets((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };
  const currentWalletData: Data[] = [{
    x: activeLabels,
    y: activeLabels.map((label) => latestByBucket.get(label)?.wallets ?? 0),
    type: "bar",
    marker: { color: activeLabels.map(bucketFillColor) },
    text: activeLabels.map((label) => fmtNumber(latestByBucket.get(label)?.wallets ?? 0)),
    textposition: "outside",
    hovertemplate: "%{x}<br>%{y:,} wallets<extra></extra>",
  }];
  const walletHistory: Data[] = activeBuckets.map((bucket) => ({
    x: holderBuckets.walletCountHistory.map((row) => row.date as string),
    y: holderBuckets.walletCountHistory.map((row) => Number(row[bucket.countColumn] || 0)),
    type: "scatter",
    mode: "lines",
    stackgroup: "one",
    name: bucket.label,
    line: { color: bucketColor(bucket.label), width: 1 },
    fillcolor: bucketFillColor(bucket.label),
    hovertemplate: "%{y:,.0f}<extra>" + bucket.label + "</extra>",
  }));
  const currentDistribution: Data[] = [{
    x: labels,
    y: labels.map((label) => latestByBucket.get(label)?.supplySharePct ?? 0),
    type: "bar",
    marker: { color: labels.map(bucketFillColor) },
    text: labels.map((label) => fmtPct(latestByBucket.get(label)?.supplySharePct ?? 0)),
    textposition: "outside",
    hovertemplate: "%{x}<br>%{y:.1f}% of supply<extra></extra>",
  }];
  const distributionHistory: Data[] = holderBuckets.buckets.map((bucket) => ({
    x: holderBuckets.holderDistributionHistory.map((row) => row.date as string),
    y: holderBuckets.holderDistributionHistory.map((row) => Number(row[bucket.pctColumn] || 0)),
    type: "scatter",
    mode: "lines",
    stackgroup: "one",
    name: bucket.label,
    line: { color: bucketColor(bucket.label), width: 1 },
    fillcolor: bucketFillColor(bucket.label),
  }));

  if (view === "wallet-count") {
    return (
      <section className="section" id="wallet-count">
        <h2>Wallet count</h2>
        <details className="filter-details">
          <summary>Filter buckets</summary>
          <div className="bucket-toggles" aria-label="Wallet count buckets">
            {labels.map((label) => (
              <label className="bucket-toggle" key={label}>
                <input checked={visibleBuckets.has(label)} onChange={() => toggleBucket(label)} type="checkbox" />
                <span className="bucket-swatch" style={{ background: bucketColor(label) }} />
                {label}
              </label>
            ))}
          </div>
        </details>
        <div className="metric-grid"><Metric label="Wallet count" value={fmtNumber(visibleWalletCount)} /></div>
        <InfoTooltip text="- Current wallet counts are grouped by each wallet's latest TIBBIR balance." />
        <Plot data={currentWalletData} layout={{ height: 280, showlegend: false, xaxis: { type: "category" } as Partial<Layout["xaxis"]> }} className="compact-chart" />
        <h3>History</h3>
        <Plot data={walletHistory} layout={{ height: 400, hovermode: "x unified" }} />
      </section>
    );
  }

  if (view === "holder-distribution") {
    return (
      <section className="section" id="holder-distribution">
        <h2>Holder distribution</h2>
        <InfoTooltip text="- The chart shows what share of current TIBBIR supply is held by wallets in each balance bucket." />
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
        <h3>History</h3>
        <Plot data={distributionHistory} layout={{ height: 400, hovermode: "x unified", yaxis: { range: [0, 100] } as Partial<Layout["yaxis"]> }} />
      </section>
    );
  }

  return (
    <section className="section" id="wallets-vs-supply">
      <h2>Wallets vs supply by bucket</h2>
      <div className="section-table">
        <Table
          columns={["Bucket", "Wallets", "% of wallets", "% of supply"]}
          rows={holderBuckets.latest.map((row) => ({
            Bucket: row.bucket,
            Wallets: fmtNumber(row.wallets),
            "% of wallets": <ProgressValue value={row.walletSharePct} />,
            "% of supply": <ProgressValue value={row.supplySharePct} />,
          }))}
        />
      </div>
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
  const filtered = rows.filter((row) => String(row[searchKey] || "").toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wallet" />
      <div className="scroll-table wallet-search-results">
        <Table columns={columns} rows={filtered.map(rowMapper)} />
      </div>
    </>
  );
}

export function DashboardApp() {
  const { data, error } = useDashboardData();
  const [activeView, setActiveView] = useState<DashboardView>("price");
  if (error) return <main className="page"><div className="status">{error}</div></main>;
  if (!data) return <main className="page"><div className="status">Loading dashboard data...</div></main>;

  const meta = data.metadata.metadata;
  const circulatingSupply =
    Number(meta.total_minted_supply || 0) -
    Number(meta.burned_supply || 0) -
    Number(meta.dead_address_supply || 0);
  return (
    <main className="page">
      <header className="brand brand-logo-only">
        <Image src="/tibson.avif" alt="tibson" width={88} height={88} priority />
      </header>
      <section className="section top-summary">
        <div className="metric-grid">
          <Metric label="Last updated" value={String(meta.last_updated_utc || "-").replace("T", " ").slice(0, 16) + " UTC"} />
          <Metric label="Latest block" value={fmtNumber(Number(meta.end_block || 0))} />
        </div>
        <ul className="note-list">
          <li>Transaction data updates ~every 4 hours</li>
          <li>Price data updates daily</li>
        </ul>
        <p><a href="/dataset-details">Read more details about data coverage</a></p>
      </section>
      <ChartNavigation activeView={activeView} onChange={setActiveView} />
      {activeView === "price" && <PriceStory price={data.price} context={data.priceContext} />}
      {activeView === "chad" && <ChadWallets chad={data.chad} contract={data.metadata.contractAddress} circulatingSupply={circulatingSupply} />}
      {activeView === "soulbound" && <SoulboundWallets soulbound={data.soulbound} contract={data.metadata.contractAddress} circulatingSupply={circulatingSupply} />}
      {(activeView === "wallet-count" || activeView === "holder-distribution" || activeView === "wallets-vs-supply") && (
        <HolderBuckets holderBuckets={data.holderBuckets} view={activeView} />
      )}
    </main>
  );
}
