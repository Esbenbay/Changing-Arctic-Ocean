import React from "react";
import Plot from "react-plotly.js";

export default function BarChart(props) {
  const { parentHeight, parentWidth } = props;

  const x = ["Pan-Arctic", "Indian Ocean", "Atlantic Ocean","Pacific Ocean", "Antarctic Ocean"];
  const y = [10, 6, 3,5,1];

  const customColors = ["#4CAF50", "#FFC107", "#9C27B0", "#029321", "#ff8932"];

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
            type: "bar",
            x,
            y,
            marker: { color: customColors.slice(0, x.length) },
            hovertemplate: "%{x}<br>%{y}<extra></extra>",
          },
        ]}
        layout={{
          autosize: false,
          height: parentHeight,
          width: parentWidth,
          title: "Contineltal Shelf Area (in million km²)",
          xaxis: { title: "Test" },
          yaxis: { title: "Value" },
          margin: { l: 60, r: 20, t: 60, b: 60 },
        }}
        style={{ width: "100%", height: "100%" }}
        config={{ displayModeBar: false, responsive: true }}
      />
    </div>
  );
}