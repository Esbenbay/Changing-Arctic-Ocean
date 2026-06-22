import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { track } from '../tracker.js';

const BASE = import.meta.env.BASE_URL;

const QUIZ_OPTIONS = [
  { label: 'Arctic',        correct: true  },
  { label: 'Europe',        correct: false },
  { label: 'Antarctica',    correct: false },
  { label: 'North America', correct: false },
];

export const TempQuiz = memo(function TempQuiz({ onCorrectAnswer, onAnswer }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (opt) => {
    setSelected(opt);
    onAnswer?.(opt.label);
    if (opt.correct) onCorrectAnswer?.();
  };

  return (
    <div className="temp-quiz" style={{ animation: 'slideUpFade 1100ms cubic-bezier(0.22,1,0.36,1) 200ms both' }}>
      <div className="temp-quiz-title">
        Which region has seen the largest increase in average temperature?
      </div>
      <div className="temp-quiz-options">
        {QUIZ_OPTIONS.map(opt => {
          const picked = selected === opt;
          const bg    = picked ? (opt.correct ? '#e8f5e9' : '#ffebee') : 'white';
          const border = picked ? (opt.correct ? '#2e7d32' : '#c0392b') : '#ddd';
          return (
            <button
              key={opt.label}
              onClick={() => handleClick(opt)}
              className="temp-quiz-option"
              style={{
                border: `2px solid ${border}`, background: bg,
              }}
            >
              {opt.label}{picked && (opt.correct ? ' ✓' : ' ✗')}
            </button>
          );
        })}
      </div>
    </div>
  );
});

function interpolateY(data, year) {
  if (!data || year == null) return null;
  const idx = data.x.findIndex(x => x >= year);
  if (idx <= 0) return data.y[0] ?? null;
  if (idx >= data.x.length) return data.y[data.y.length - 1];
  const x0 = data.x[idx - 1], x1 = data.x[idx];
  const y0 = data.y[idx - 1], y1 = data.y[idx];
  return y0 + (y1 - y0) * ((year - x0) / (x1 - x0));
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const REGION_LINES = {
  'Europe':       { file: `${BASE}average_temp_europe.json`,       color: '#e67e22', width: 2 },
  'Antarctica':   { file: `${BASE}average_temp_antarctic.json`,    color: '#00bcd4', width: 2 },
  'North America':{ file: `${BASE}average_temp_north_america.json`,color: '#9b59b6', width: 2 },
};

export default memo(function TemperatureLineChart({ step, currentYear, startYear = 1885, endYear = 2025, onYearSelect, arcticRevealed = false, showAllRegions = false }) {
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const prevYearRef  = useRef(null);

  const [width, setWidth]               = useState(320);
  const [viewport, setViewport]         = useState(() => ({
    width:  typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  }));
  const [worldData, setWorldData]       = useState(null);
  const [hasDragged, setHasDragged]     = useState(false);
  const [arcticData, setArcticData]     = useState(null);
  const [regionData, setRegionData]     = useState({});
  const [displayYear, setDisplayYear]   = useState(null);
  const [isDragging,  setIsDragging]    = useState(false);

  const dragYearRef = useRef(null);

  const isTinyChart = width < 430 || viewport.height < 680;
  const isCompactChart = isTinyChart || width < 560 || viewport.height < 780;
  const chartHeight = Math.round(clamp(
    width * (isTinyChart ? 0.62 : 0.52),
    isTinyChart ? 210 : 245,
    clamp(viewport.height * 0.34, isTinyChart ? 220 : 260, isCompactChart ? 300 : 340)
  ));
  const margin = useMemo(() => ({
    l: isTinyChart ? 38 : isCompactChart ? 44 : 50,
    r: isTinyChart ? 6 : 12,
    t: isTinyChart ? 28 : isCompactChart ? 32 : 38,
    b: isTinyChart ? 34 : isCompactChart ? 40 : 46,
  }), [isCompactChart, isTinyChart]);
  const chartFontSize = isTinyChart ? 9 : isCompactChart ? 10 : 12;
  const titleFontSize = isTinyChart ? 13 : isCompactChart ? 15 : 20;
  const lineWidth = isTinyChart ? 2 : isCompactChart ? 2.2 : 2.5;
  const markerSize = isTinyChart ? 7 : isCompactChart ? 8 : 10;
  const handleHitWidth = isTinyChart ? 24 : 28;
  const handlePillWidth = isTinyChart ? 36 : isCompactChart ? 40 : 44;
  const handlePillHeight = isTinyChart ? 20 : 24;
  const plotWidth = Math.max(260, Math.round(width));
  const plotAreaWidth = Math.max(1, plotWidth - margin.l - margin.r);

  const handleDragMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t  = Math.max(0, Math.min(1, (e.clientX - rect.left - margin.l) / plotAreaWidth));
    const yr = Math.min(endYear, Math.max(startYear, Math.round(startYear + t * (endYear - startYear))));
    onYearSelect?.(yr);
    dragYearRef.current = yr;
  }, [margin.l, plotAreaWidth, startYear, endYear, onYearSelect]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    setHasDragged(true);
    handleDragMove(e);
  }, [handleDragMove]);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => {
      setIsDragging(false);
      if (dragYearRef.current != null) track('chart_drag_complete', { year: dragYearRef.current });
    };
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup',  onUp);
    window.addEventListener('pointercancel',  onUp);
    return () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup',  onUp);
      window.removeEventListener('pointercancel',  onUp);
    };
  }, [isDragging, handleDragMove]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width)));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const parse = json => Object.entries(json.data)
      .filter(([y]) => Number(y) >= startYear && Number(y) <= endYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .reduce((acc, [y, v]) => {
        acc.x.push(Number(y)); acc.y.push(v.departure); return acc;
      }, { x: [], y: [] });

    fetch(`${BASE}average_temp_world.json`).then(r => r.json()).then(d => setWorldData(parse(d)));
    Promise.all([
      fetch(`${BASE}average_temp_arctic.json`).then(r => r.json()).then(d => ['__arctic__', parse(d)]),
      ...Object.entries(REGION_LINES).map(([name, cfg]) =>
        fetch(cfg.file).then(r => r.json()).then(d => [name, parse(d)])
      ),
    ]).then(entries => {
      const map = Object.fromEntries(entries);
      setArcticData(map['__arctic__']);
      const { __arctic__: _, ...rest } = map;
      setRegionData(rest);
    });
  }, [startYear, endYear]);

  // Smoothly animate the dot between year steps
  useEffect(() => {
    if (!currentYear) return;
    const from = prevYearRef.current ?? currentYear;
    prevYearRef.current = currentYear;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (from === currentYear) {
      animFrameRef.current = requestAnimationFrame(() => {
        setDisplayYear(currentYear);
        animFrameRef.current = null;
      });
      return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    }

    const DURATION = 350;
    const start = performance.now();
    const animate = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplayYear(from + (currentYear - from) * eased);
      if (t < 1) animFrameRef.current = requestAnimationFrame(animate);
      else animFrameRef.current = null;
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [currentYear]);

  const dotY = interpolateY(worldData, displayYear);

  const showArctic  = step === 'arctic' || arcticRevealed || showAllRegions;
  const yRange = showArctic || showAllRegions ? [-4, 4] : [-2, 2];

  const traces = worldData ? [
    {
      x: worldData.x, y: worldData.y,
      type: 'scatter', mode: 'lines', name: 'Global',
      line: { color: '#5b8dd9', width: isTinyChart ? 1.6 : 2 },
      hovertemplate: '%{x}: %{y:.2f}°C<extra>Global</extra>',
    },
    ...(showAllRegions ? Object.entries(REGION_LINES).map(([name, cfg]) => {
      const d = regionData[name];
      if (!d) return null;
      return { x: d.x, y: d.y, type: 'scatter', mode: 'lines', name,
        line: { color: cfg.color, width: isTinyChart ? Math.max(1.5, cfg.width - 0.4) : cfg.width },
        hovertemplate: `%{x}: %{y:.2f}°C<extra>${name}</extra>` };
    }).filter(Boolean) : []),
    ...(showArctic && arcticData ? [{
      x: arcticData.x, y: arcticData.y,
      type: 'scatter', mode: 'lines', name: 'Arctic',
      line: { color: '#e74c3c', width: lineWidth },
      hovertemplate: '%{x}: %{y:.2f}°C<extra>Arctic</extra>',
    }] : []),
    ...(displayYear != null && dotY != null ? [{
      x: [displayYear], y: [dotY],
      type: 'scatter', mode: 'markers',
      showlegend: false,
      marker: { color: '#f39c12', size: markerSize, line: { color: 'white', width: isTinyChart ? 1.4 : 2 } },
      hovertemplate: `${Math.round(displayYear)}: %{y:.2f}°C<extra></extra>`,
    }] : []),
  ] : [];

  const lineX = displayYear != null
    ? margin.l + (displayYear - startYear) / (endYear - startYear) * plotAreaWidth
    : null;
  const titleText = showArctic
    ? isTinyChart ? 'Global vs Arctic Warming' : 'Global vs Arctic Warming (1880-2025)'
    : isTinyChart ? 'Global Temperature Anomaly' : 'Global Temperature Anomaly (1880-2025)';
  const legend = isCompactChart
    ? {
        orientation: 'h',
        x: 0,
        y: -0.18,
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.86)',
        font: { size: chartFontSize },
        itemwidth: 30,
      }
    : {
        x: 0.02,
        y: 0.98,
        bgcolor: 'rgba(255,255,255,0.8)',
        font: { size: chartFontSize },
      };

  return (
    <div ref={containerRef} className="temperature-chart-wrap">
      {worldData && (
        <div style={{ position: 'relative', userSelect: 'none' }}>
        <Plot
          data={traces}
          layout={{
            autosize: false,
            width: plotWidth,
            height: chartHeight,
            margin,
            font: { family: 'Arial, Helvetica, sans-serif', size: chartFontSize, color: '#24384c' },
            xaxis: {
              title: { text: 'Year', standoff: isTinyChart ? 7 : 12, font: { size: chartFontSize } },
              gridcolor: '#eee',
              range: [startYear, endYear],
              autorange: false,
              ticklen: isTinyChart ? 3 : 6,
              tickfont: { size: chartFontSize },
              nticks: isTinyChart ? 4 : isCompactChart ? 5 : 7,
            },
            yaxis: {
              title: { text: isTinyChart ? 'Anomaly' : 'Anomaly (°C)', standoff: isTinyChart ? 4 : 10, font: { size: chartFontSize } },
              gridcolor: '#eee',
              zeroline: true,
              zerolinecolor: '#bbb',
              range: yRange,
              autorange: false,
              ticklen: isTinyChart ? 4 : 10,
              tickfont: { size: chartFontSize },
              nticks: isTinyChart ? 5 : 7,
            },
            legend,
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            title: {
              text: titleText,
              font: { size: titleFontSize },
            },
          }}
          config={{ displayModeBar: false, responsive: false, staticPlot: true }}
        />
        {/* Draggable year indicator line */}
        {lineX != null && (
          <div
            onPointerDown={handleDragStart}
            style={{
              position: 'absolute',
              left: lineX,
              top: margin.t,
              height: chartHeight - margin.t - margin.b,
              width: handleHitWidth,
              cursor: 'ew-resize',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
            }}
          >
            <div style={{
              position: 'absolute',
              top: isTinyChart ? -13 : -16,
              left: '50%',
              width: handlePillWidth,
              height: handlePillHeight,
              borderRadius: 999,
              background: '#f39c12',
              border: '2px solid white',
              boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
              transform: 'translateX(-50%)',
              animation: !hasDragged ? 'handleNudge 1.65s ease-in-out infinite' : 'none',
            }}>
              <span style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: '6px solid white',
                transform: 'translateY(-50%)',
              }} />
              <span style={{
                position: 'absolute',
                right: 9,
                top: '50%',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: '6px solid white',
                transform: 'translateY(-50%)',
              }} />
            </div>
            <div style={{
              position: 'absolute',
              inset: '-8px 7px',
              borderRadius: 999,
              background: 'rgba(243,156,18,0.14)',
              opacity: isDragging ? 1 : 0.75,
              animation: !hasDragged ? 'dragPulse 1.45s ease-in-out infinite' : 'none',
            }} />
            {/* Visible line */}
            <div style={{
              width: isDragging ? 7 : 5,
              height: '100%',
              background: '#f39c12',
              borderRadius: 999,
              opacity: 1,
              boxShadow: isDragging
                ? '0 0 0 4px rgba(243,156,18,0.24), 0 0 16px rgba(243,156,18,0.7)'
                : '0 0 0 2px rgba(255,255,255,0.9), 0 0 10px rgba(243,156,18,0.35)',
              transition: 'width 150ms ease, box-shadow 150ms ease',
            }} />
          </div>
        )}
        {/* Capture drag events across the full chart area */}
        {isDragging && (
          <div style={{ position: 'absolute', inset: 0, cursor: 'ew-resize', touchAction: 'none' }} />
        )}
        </div>
      )}
    </div>
  );
});
