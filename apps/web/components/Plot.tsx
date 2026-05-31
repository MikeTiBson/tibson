"use client";

import dynamic from "next/dynamic";
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
  font: { color: "#f8fafc", family: "Inter, sans-serif" },
  margin: { t: 22, r: 12, b: 68, l: 42 },
  legend: {
    orientation: "h",
    x: 0,
    y: -0.18,
    font: { size: 13 },
  },
  xaxis: {
    gridcolor: "rgba(248,250,252,0.10)",
    zerolinecolor: "rgba(248,250,252,0.16)",
  },
  yaxis: {
    gridcolor: "rgba(248,250,252,0.14)",
    zerolinecolor: "rgba(248,250,252,0.16)",
  },
};

export function Plot({ data, layout, className = "chart" }: { data: Data[]; layout?: Partial<Layout>; className?: string }) {
  return (
    <Plotly
      className={className}
      config={config}
      data={data}
      layout={{ ...baseLayout, ...layout }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
