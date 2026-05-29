import { useState, useEffect, useRef, useCallback } from 'react';
import Plot from 'react-plotly.js';
import { track } from '../tracker.js';

const BASE = import.meta.env.BASE_URL;

const QUIZ_OPTIONS = [
  { label: 'Arctic',        correct: true  },
  { label: 'Europe',        correct: false },
  { label: 'Antarctica',    correct: false },
  { label: 'North America', correct: false },
];

export function TempQuiz({ onCorrectAnswer, onAnswer }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (opt) => {
    setSelected(opt);
    onAnswer?.(opt.label);
    if (opt.correct) onCorrectAnswer?.();
  };

  return (
    <div style={{ marginTop: 20, animation: 'slideUpFade 1100ms cubic-bezier(0.22,1,0.36,1) 200ms both' }}>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#222', marginBottom: 12 }}>
        Which region has seen the largest increase in average temperature?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {QUIZ_OPTIONS.map(opt => {
          const picked = selected === opt;
          const bg    = picked ? (opt.correct ? '#e8f5e9' : '#ffebee') : 'white';
          const border = picked ? (opt.correct ? '#2e7d32' : '#c0392b') : '#ddd';
          return (
            <button
              key={opt.label}
              onClick={() => handleClick(opt)}
              style={{
                padding: '10px 16px', borderRadius: 8,
                border: `2px solid ${border}`, background: bg,
                cursor: 'pointer', textAlign: 'left',
                fontWeight: 500, color: '#333',
                transition: 'all 800ms ease',
              }}
            >
              {opt.label}{picked && (opt.correct ? ' ✓' : ' ✗')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function interpolateY(data, year) {
  if (!data || year == null) return null;
  const idx = data.x.findIndex(x => x >= year);
  if (idx <= 0) return data.y[0] ?? null;
  if (idx >= data.x.length) return data.y[data.y.length - 1];
  const x0 = data.x[idx - 1], x1 = data.x[idx];
  const y0 = data.y[idx - 1], y1 = data.y[idx];
  return y0 + (y1 - y0) * ((year - x0) / (x1 - x0));
}

const MARGIN  = { l: 50, r: 12, t: 36, b: 44 };
const CHART_H = 340;

const REGION_LINES = {
  'Europe':       { file: `${BASE}average_temp_europe.json`,       color: '#e67e22', width: 2 },
  'Antarctica':   { file: `${BASE}average_temp_antarctic.json`,    color: '#00bcd4', width: 2 },
  'North America':{ file: `${BASE}average_temp_north_america.json`,color: '#9b59b6', width: 2 },
};

export default function TemperatureLineChart({ step, currentYear, startYear = 1885, endYear = 2025, onYearSelect, arcticRevealed = false, showAllRegions = false }) {
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const prevYearRef  = useRef(null);

  const [width, setWidth]               = useState(320);
  const [worldData, setWorldData]       = useState(null);
  const [hasDragged, setHasDragged]     = useState(false);
  const [arcticData, setArcticData]     = useState(null);
  const [regionData, setRegionData]     = useState({});
  const [displayYear, setDisplayYear]   = useState(null);
  const [isDragging,  setIsDragging]    = useState(false);

  const dragYearRef = useRef(null);

  const handleDragMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pw = width - MARGIN.l - MARGIN.r;
    const t  = Math.max(0, Math.min(1, (e.clientX - rect.left - MARGIN.l) / pw));
    const yr = Math.min(endYear, Math.max(startYear, Math.round(startYear + t * (endYear - startYear))));
    onYearSelect?.(yr);
    dragYearRef.current = yr;
  }, [width, startYear, endYear, onYearSelect]);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => {
      setIsDragging(false);
      if (dragYearRef.current != null) track('chart_drag_complete', { year: dragYearRef.current });
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup',  onUp);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup',  onUp);
    };
  }, [isDragging, handleDragMove]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
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
    if (from === currentYear) { setDisplayYear(currentYear); return; }

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
      type: 'scatter', mode: 'lines', name: 'Global Average',
      line: { color: '#5b8dd9', width: 2 },
      hovertemplate: '%{x}: %{y:.2f}°C<extra>Global</extra>',
    },
    ...(showAllRegions ? Object.entries(REGION_LINES).map(([name, cfg]) => {
      const d = regionData[name];
      if (!d) return null;
      return { x: d.x, y: d.y, type: 'scatter', mode: 'lines', name,
        line: { color: cfg.color, width: cfg.width },
        hovertemplate: `%{x}: %{y:.2f}°C<extra>${name}</extra>` };
    }).filter(Boolean) : []),
    ...(showArctic && arcticData ? [{
      x: arcticData.x, y: arcticData.y,
      type: 'scatter', mode: 'lines', name: 'Arctic',
      line: { color: '#e74c3c', width: 2.5 },
      hovertemplate: '%{x}: %{y:.2f}°C<extra>Arctic</extra>',
    }] : []),
    ...(displayYear != null && dotY != null ? [{
      x: [displayYear], y: [dotY],
      type: 'scatter', mode: 'markers',
      showlegend: false,
      marker: { color: '#f39c12', size: 10, line: { color: 'white', width: 2 } },
      hovertemplate: `${Math.round(displayYear)}: %{y:.2f}°C<extra></extra>`,
    }] : []),
  ] : [];

  const lineX = displayYear != null
    ? MARGIN.l + (displayYear - startYear) / (endYear - startYear) * (width - MARGIN.l - MARGIN.r)
    : null;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {worldData && (
        <div style={{ position: 'relative', userSelect: 'none' }}>
        <Plot
          data={traces}
          layout={{
            autosize: false,
            width,
            height: CHART_H,
            margin: MARGIN,
            xaxis: { title: { text: 'Year', standoff: 16 }, gridcolor: '#eee', range: [startYear, endYear], autorange: false, ticklen: 6 },
            yaxis: { title: { text: 'Anomaly (°C)', standoff: 10 }, gridcolor: '#eee', zeroline: true, zerolinecolor: '#bbb', range: yRange, autorange: false, ticklen: 10 },
            legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(255,255,255,0.8)' },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            title: {
              text: showArctic
                ? 'Global vs Arctic Warming (1880–2025)'
                : 'Global Temperature Anomaly (1880–2025)',
              font: { size: 20 },
            },
          }}
          config={{ displayModeBar: false, responsive: false, staticPlot: true }}
        />
        {/* Draggable year indicator line */}
        {lineX != null && (
          <div
            onMouseDown={e => { e.preventDefault(); setIsDragging(true); setHasDragged(true); }}
            style={{
              position: 'absolute',
              left: lineX,
              top: MARGIN.t,
              height: CHART_H - MARGIN.t - MARGIN.b,
              width: 28,
              cursor: 'ew-resize',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Visible line */}
            <div style={{
              width: 4,
              height: '100%',
              background: '#f39c12',
              borderRadius: 2,
              opacity: isDragging ? 1 : 0.85,
              boxShadow: isDragging ? '0 0 8px rgba(243,156,18,0.6)' : 'none',
              transition: 'box-shadow 150ms ease',
              animation: !hasDragged ? 'dragPulse 1.4s ease-in-out infinite' : 'none',
            }} />
          </div>
        )}
        {/* Capture drag events across the full chart area */}
        {isDragging && (
          <div style={{ position: 'absolute', inset: 0, cursor: 'ew-resize' }} />
        )}
        </div>
      )}
    </div>
  );
}
