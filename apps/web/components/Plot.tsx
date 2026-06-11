"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Layout, Config, Data } from "plotly.js";

const Plotly = dynamic(() => import("react-plotly.js"), { ssr: false });

const config: Partial<Config> = {
  displaylogo: false,
  doubleClick: false,
  modeBarButtonsToRemove: ["autoScale2d", "lasso2d", "pan2d", "resetScale2d", "select2d", "zoom2d", "zoomIn2d", "zoomOut2d"],
  responsive: true,
  scrollZoom: false,
  toImageButtonOptions: {
    format: "png",
    filename: "tibson-analytics-chart",
    height: 720,
    scale: 2,
    width: 1280,
  },
};

const baseLayout: Partial<Layout> = {
  autosize: true,
  dragmode: false,
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#fff7e8", family: "Inter, sans-serif", size: 14 },
  margin: { t: 22, r: 12, b: 68, l: 42 },
  legend: {
    orientation: "h",
    x: 0,
    y: -0.18,
    font: { size: 14 },
  },
  hoverlabel: {
    bgcolor: "#21180d",
    bordercolor: "rgba(255,247,232,0.58)",
    font: { color: "#fff7e8", family: "Inter, sans-serif", size: 13 },
  },
  xaxis: {
    showgrid: false,
    zeroline: false,
    tickfont: { size: 13 },
  },
  yaxis: {
    showgrid: false,
    zeroline: false,
    tickfont: { size: 13 },
  },
};

export function Plot({
  data,
  layout,
  className = "chart",
  loadingHeight,
  onReady,
}: {
  data: Data[];
  layout?: Partial<Layout>;
  className?: string;
  loadingHeight?: number;
  onReady?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const height = Number(layout?.height || loadingHeight || 360);
  const mergedLayout = useMemo(() => ({
    ...baseLayout,
    ...layout,
    xaxis: { ...baseLayout.xaxis, ...layout?.xaxis },
    yaxis: { ...baseLayout.yaxis, ...layout?.yaxis },
  }), [layout]);

  const handleReady = () => {
    setReady(true);
    onReady?.();
  };

  return (
    <div className={`plot-shell ${ready ? "ready" : "loading"}`} style={{ minHeight: height }}>
      {!ready && (
        <div aria-hidden="true" className="chart-skeleton" style={{ minHeight: height }}>
          <span className="chart-skeleton-block" />
        </div>
      )}
      <Plotly
        className={className}
        config={config}
        data={data}
        layout={mergedLayout}
        onInitialized={handleReady}
        onUpdate={handleReady}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
