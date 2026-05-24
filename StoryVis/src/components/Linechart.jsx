import React from "react";
import Plot from "react-plotly.js";

export default function LineChart({ parentHeight, parentWidth }) {
  const x = [
    "2010",
    "2011",
    "2012",
  
  ];

  const y = [10, 6, 3, 5, 1];

  return (
    <div
      style={{
        width: `${parentWidth}px`,
        maxWidth: `${parentWidth}px`,
        height: `${parentHeight}px`,
        display: "flex",
        overflow: "hidden",
      }}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            x,
            y,
            line: { color: "#4CAF50", width: 3 },
            marker: { size: 8, color: "#4CAF50" },
            hovertemplate: "%{x}<br>%{y}<extra></extra>",
          },
        ]}
        layout={{
          autosize: false,
          height: parentHeight,
          width: parentWidth,

          title: {
            text: "Sea Ice Extent (in million km²)",
            x: 0.5,
            xanchor: "center",
            font: { size: 16 },
          },

          xaxis: {
            title: "Ocean region",
            tickangle: -20,
          },
          yaxis: {
            title: "Million km²",
          },

          margin: { l: 60, r: 20, t: 60, b: 80 },
        }}
        style={{ width: "100%", height: "100%" }}
        config={{ displayModeBar: false, responsive: true }}
      />
    </div>
  );
}
