import { useState, useEffect, useRef } from 'react';
import { Map, Source, Layer } from 'react-map-gl/mapbox';
import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

// NSIDC Polar Stereographic North (EPSG:3411) — Hughes 1980 ellipsoid
proj4.defs('EPSG:3411', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +a=6378273 +b=6356889.449 +units=m +no_defs');

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Built-in color functions
function anomalyColor(val, vmin, vmax) {
  const t = Math.max(0, Math.min(1, (val - vmin) / (vmax - vmin)));
  if (t < 0.5) {
    const s = t * 2;
    return [Math.round(s * 255), Math.round(s * 255), 255, 210];
  }
  const s = (t - 0.5) * 2;
  return [255, Math.round((1 - s) * 255), Math.round((1 - s) * 255), 210];
}

function iceExtentColor(val) {
  return val > 0.5 ? [200, 230, 255, 220] : [0, 0, 0, 0];
}

// Decode one COG band → { dataUrl, coordinates, year }
async function decodeCOG(url, year, vmin, vmax, colorFn) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No data available for ${year}`);
  const tiff = await fromArrayBuffer(await resp.arrayBuffer());
  const image = await tiff.getImage(0);

  const bbox    = image.getBoundingBox();
  const nodata  = image.getGDALNoData();
  const [west, south, east, north] = bbox;
  const isProjected = Math.abs(west) > 360 || Math.abs(east) > 360;

  // Read source raster at native resolution for accurate lookups
  const srcW = image.getWidth();
  const srcH = image.getHeight();
  const rasters = await image.readRasters({ interleave: false, fillValue: nodata ?? NaN });
  const band = rasters[0];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (isProjected) {
    // Inverse-warp: for each output geographic pixel, look up source value in PS grid
    const outW = 720, outH = 360;
    canvas.width = outW;
    canvas.height = outH;
    const imgData = ctx.createImageData(outW, outH);
    const px = imgData.data;
    const toPSN = proj4('WGS84', 'EPSG:3411');
    for (let row = 0; row < outH; row++) {
      const lat = 90 - (row / outH) * 180;
      if (lat < 25) break;
      for (let col = 0; col < outW; col++) {
        const lon = -180 + (col / outW) * 360;
        const [px_ps, py_ps] = toPSN.forward([lon, lat]);
        const srcCol = Math.round((px_ps - west)  / (east  - west)  * srcW);
        const srcRow = Math.round((north - py_ps) / (north - south) * srcH);
        if (srcCol < 0 || srcCol >= srcW || srcRow < 0 || srcRow >= srcH) continue;
        const v = band[srcRow * srcW + srcCol];
        if (v === nodata || isNaN(v)) continue;
        const [r, g, b, a] = colorFn(v, vmin, vmax);
        const i = (row * outW + col) * 4;
        px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      coordinates: [[-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511]],
      year,
    };
  }

  // Geographic CRS: render at native resolution so pixel indices map correctly
  canvas.width  = srcW;
  canvas.height = srcH;
  const imgData = ctx.createImageData(srcW, srcH);
  const px = imgData.data;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (v === nodata || isNaN(v)) continue;
    const [r, g, b, a] = colorFn(v, vmin, vmax);
    px[i*4] = r; px[i*4+1] = g; px[i*4+2] = b; px[i*4+3] = a;
  }
  ctx.putImageData(imgData, 0, 0);
  const N = Math.min(north, 85.0511), S = Math.max(south, -85.0511);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    coordinates: [[west, N], [east, N], [east, S], [west, S]],
    year,
  };
}

// ─────────────────────────────────────────────────────────────
// Props:
//   getUrl(year) → string        URL template
//   startYear / endYear          year range  (default 1950 / 2025)
//   yearStep                     step size   (default 5)
//   vmin / vmax                  color scale bounds (default ±3)
//   mode                         'anomaly' (default) | 'ice'
//   legendTitle                  label above the legend
//   legendGradient               CSS gradient string for the color bar
//   legendLabels                 [left, center, right] label strings
// ─────────────────────────────────────────────────────────────
export default function CogTemperatureMap({
  getUrl,
  startYear   = 1900,
  endYear     = 2025,
  yearStep    = 5,
  vmin        = -3,
  vmax        = 3,
  mode        = 'anomaly',
  legendTitle,
  legendGradient,
  legendLabels,
  onYearChange,
  externalYear,
}) {
  const colorFn = mode === 'ice' ? iceExtentColor : anomalyColor;

  const defLegendTitle    = mode === 'ice' ? 'Sea Ice Extent (Sep)' : 'Temp. Anomaly (°C)';
  const defLegendGradient = mode === 'ice'
    ? 'linear-gradient(to right, #001a33, #cce5ff)'
    : 'linear-gradient(to right, #0000ff, #ffffff, #ff0000)';
  const defLegendLabels   = mode === 'ice'
    ? ['Open ocean', '', 'Ice covered']
    : [`${vmin}`, '0', `+${vmax}`];

  const title    = legendTitle    ?? defLegendTitle;
  const gradient = legendGradient ?? defLegendGradient;
  const labels   = legendLabels   ?? defLegendLabels;

  const [year, setYear]       = useState(startYear);
  const [initLayer, setInitLayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const requestId             = useRef(0);
  const resizeObserverRef     = useRef(null);
  const cogMapRef             = useRef(null);
  const activeSlotRef         = useRef('a');
  const initializedRef        = useRef(false);
  const extDebounceRef        = useRef(null);
  const tifCacheRef           = useRef(new window.Map());

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  // When scroll drives the year externally, debounce-snap to nearest yearStep
  useEffect(() => {
    if (externalYear == null) return;
    if (extDebounceRef.current) clearTimeout(extDebounceRef.current);
    extDebounceRef.current = setTimeout(() => {
      const snapped = Math.round(externalYear / yearStep) * yearStep;
      setYear(Math.max(startYear, Math.min(endYear, snapped)));
    }, 30);
    return () => clearTimeout(extDebounceRef.current);
  }, [externalYear, yearStep, startYear, endYear]);

  // Once first image mounts both sources are ready after a short delay
  useEffect(() => {
    if (!initLayer) return;
    const t = setTimeout(() => { initializedRef.current = true; }, 100);
    return () => clearTimeout(t);
  }, [initLayer]);

  // Decode TIF whenever year changes — use cache, then pre-fetch neighbours
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const cache = tifCacheRef.current;
    const decode = cache.has(year)
      ? Promise.resolve(cache.get(year))
      : decodeCOG(getUrl(year), year, vmin, vmax, colorFn).then(r => { cache.set(year, r); return r; });

    decode
      .then(result => {
        if (id !== requestId.current) return;
        // Pre-fetch adjacent decades in the background
        [-1, 1].forEach(d => {
          const adj = year + d * yearStep;
          if (adj >= startYear && adj <= endYear && !cache.has(adj))
            decodeCOG(getUrl(adj), adj, vmin, vmax, colorFn).then(r => cache.set(adj, r)).catch(() => {});
        });
        const m = cogMapRef.current;
        if (m && initializedRef.current) {
          const incoming = activeSlotRef.current === 'a' ? 'b' : 'a';
          const outgoing = activeSlotRef.current;
          m.getSource(`cog-layer-${incoming}`).updateImage({ url: result.dataUrl, coordinates: result.coordinates });
          m.setPaintProperty(`cog-raster-${incoming}`, 'raster-opacity-transition', { duration: 200, delay: 0 });
          m.setPaintProperty(`cog-raster-${incoming}`, 'raster-opacity', 0.5);
          m.setPaintProperty(`cog-raster-${outgoing}`, 'raster-opacity-transition', { duration: 200, delay: 0 });
          m.setPaintProperty(`cog-raster-${outgoing}`, 'raster-opacity', 0);
          activeSlotRef.current = incoming;
        } else {
          setInitLayer(result);
        }
        setLoading(false);
      })
      .catch(err => {
        if (id !== requestId.current) return;
        setError(`Could not load ${year}: ${err.message}`);
        setLoading(false);
      });
  }, [year, getUrl, vmin, vmax, mode]);


  useEffect(() => {
    onYearChange?.(year);
  }, [year, onYearChange]);

  const progress = (year - startYear) / (endYear - startYear);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={
          mode === 'ice'
            ? { longitude: 0, latitude: 0, zoom: 1.5 }
            : { longitude: 0, latitude: 20, zoom: 0.5 }
        }
         mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        onLoad={e => {
          const map = e.target;
          cogMapRef.current = map;
          map.setProjection({ name: 'mercator' });
          map.setFog({
            color: 'white', 'high-color': 'white',
            'space-color': 'white', 'star-intensity': 0, 'horizon-blend': 0.02,
          });
          const observer = new ResizeObserver(() => map.resize());
          observer.observe(map.getContainer());
          resizeObserverRef.current = observer;
        }}
      >
        {initLayer && (<>
          <Source id="cog-layer-a" type="image" url={initLayer.dataUrl} coordinates={initLayer.coordinates}>
            <Layer id="cog-raster-a" type="raster" paint={{ 'raster-opacity': 0.5 }} />
          </Source>
          <Source id="cog-layer-b" type="image" url={initLayer.dataUrl} coordinates={initLayer.coordinates}>
            <Layer id="cog-raster-b" type="raster" paint={{ 'raster-opacity': 0 }} />
          </Source>
        </>)}
      </Map>

      {/* Animation controls
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        background: 'white', borderRadius: 14, padding: '14px 22px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        minWidth: 300, maxHeight: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
          <button
            onClick={() => {
              if (year >= endYear) { setYear(startYear); setPlaying(true); }
              else setPlaying(p => !p);
            }}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#c0392b', color: 'white', cursor: 'pointer',
              fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => { setYear(startYear); setPlaying(true); }}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#eee', color: '#555', cursor: 'pointer',
              fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ↺
          </button>
          <span style={{
            flex: 1, textAlign: 'right',
            fontSize: '1rem', fontWeight: 700,
            color: loading ? '#aaa' : '#222',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {year}
          </span>
        </div>

        <div style={{ width: '100%', height: 4, borderRadius: 2, background: '#eee', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#c0392b',
            width: `${progress * 100}%`,
            transition: `width ${intervalMs}ms linear`,
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{startYear}</span>
          <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{endYear}</span>
        </div>
      </div> */}

      {/* Color legend */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
        borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        fontSize: '0.78rem', userSelect: 'none',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{title} — {year}</div>
        <div style={{
          width: 160, height: 10, borderRadius: 5,
          background: gradient, marginBottom: 4,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
          <span>{labels[2]}</span>
        </div>
      </div>

      {error && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          background: 'rgba(255,255,255,0.95)', padding: '12px 20px',
          borderRadius: 10, color: '#c0392b', fontWeight: 600,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          maxWidth: 360, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

    </div>
  );
}
