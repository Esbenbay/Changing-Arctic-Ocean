import { Map, Layer, Source, Marker } from "react-map-gl/mapbox";
import { useEffect, useRef, useState, useCallback } from "react";
import { track } from "../tracker.js";
import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

proj4.defs('EPSG:3411', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +a=6378273 +b=6356889.449 +units=m +no_defs');

const TEMP_COLOR_STOPS = [
  { t: 0.00, rgba: [49, 54, 149, 185] },
  { t: 0.25, rgba: [116, 173, 209, 135] },
  { t: 0.50, rgba: [246, 244, 232, 25] },
  { t: 0.75, rgba: [253, 174, 97, 145] },
  { t: 1.00, rgba: [165, 0, 38, 195] },
];

const lerp = (a, b, t) => a + (b - a) * t;

function anomalyColor(val, vmin, vmax) {
  const t = Math.max(0, Math.min(1, (val - vmin) / (vmax - vmin)));
  const hiIndex = TEMP_COLOR_STOPS.findIndex(stop => t <= stop.t);
  const hi = TEMP_COLOR_STOPS[Math.max(hiIndex, 1)];
  const lo = TEMP_COLOR_STOPS[Math.max(hiIndex - 1, 0)];
  const localT = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
  return lo.rgba.map((channel, i) => Math.round(lerp(channel, hi.rgba[i], localT)));
}

const hasCogLayer = (map, slot) =>
  Boolean(map.getSource(`cog-${slot}`) && map.getLayer(`cog-raster-${slot}`));

async function decodeCOG(url, vmin, vmax) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const tiff  = await fromArrayBuffer(await resp.arrayBuffer());
  const image = await tiff.getImage(0);
  const bbox   = image.getBoundingBox();
  const nodata = image.getGDALNoData();
  const [west, south, east, north] = bbox;
  const isProjected = Math.abs(west) > 360 || Math.abs(east) > 360;
  const srcW = image.getWidth(), srcH = image.getHeight();
  const rasters = await image.readRasters({ interleave: false, fillValue: nodata ?? NaN });
  const band = rasters[0];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (isProjected) {
    const outW = 720, outH = 360;
    canvas.width = outW; canvas.height = outH;
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
        const [r, g, b, a] = anomalyColor(v, vmin, vmax);
        const i = (row * outW + col) * 4;
        px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), coordinates: [[-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511]] };
  }
  canvas.width = srcW; canvas.height = srcH;
  const imgData = ctx.createImageData(srcW, srcH);
  const px = imgData.data;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (v === nodata || isNaN(v)) continue;
    const [r, g, b, a] = anomalyColor(v, vmin, vmax);
    px[i*4] = r; px[i*4+1] = g; px[i*4+2] = b; px[i*4+3] = a;
  }
  ctx.putImageData(imgData, 0, 0);
  const N = Math.min(north, 85.0511), S = Math.max(south, -85.0511);
  return { dataUrl: canvas.toDataURL('image/png'), coordinates: [[west, N], [east, N], [east, S], [west, S]] };
}

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const BASE  = import.meta.env.BASE_URL;
const SATELLITE_MAP_STYLE = "mapbox://styles/mapbox/standard-satellite";
const TEMPERATURE_MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const COG_YEARS = [...Array.from({ length: 15 }, (_, i) => 1880 + i * 10), 2025];

const alterSpeed = 0.8;
const alterPitch = 2;
const introFlyEasing = t => t * t * t;

const snapCogYear = year =>
  Math.max(1880, Math.min(2025, Math.round(year / 10) * 10));

// ── Named camera positions ────────────────────────────────────────────────────
// Keys are referenced from the `camera` field in Story.jsx's STEPS array.

const CAMERAS = {
  // Map chapter
  'arctic-quiz':    { center: [0, 85], zoom: 2.7,    speed: alterSpeed, pitch: 0, bearing: 0, projection: 'globe' },
  'world-overview': { center: [1,           0        ], zoom: 0.5,  speed: alterSpeed, pitch: alterPitch },
  'svalbard':       { center: [15.678037,   77.746261], zoom: 14.5, speed: alterSpeed, pitch: alterPitch },
  'canada-arctic':  { center: [-99.214076,  73.476835], zoom: 3.7,  speed: alterSpeed, pitch: alterPitch },

  //'arctic-coastline':  { center: [120.734026, 85.53], zoom: 2.6,    speed: alterSpeed, pitch: 25, duration: 10000},
  'arctic-coastline':  { center: [0, 85], zoom: 2.7,    speed: alterSpeed, pitch: 0 , projection: 'globe'    },
  'greenland-overview':  { center: [-42, 72],              zoom: 3, speed: alterSpeed, pitch: alterPitch },
  'greenland-glaciers':  { center: [-41.338798, 64.249670], zoom: 9, speed: alterSpeed, pitch: alterPitch },

  // Intro arctic step (interactive, no bathymetry)
  'intro-arctic':   { center: [16.57969, 77.82355], zoom: 9.508,  pitch: 0, bearing: 0, jump: true, projection: 'mercator' },
  // Global temperature overview — used when temperature layer is active
  'global-temp':    { center: [0, 20], zoom: 1.0, pitch: 0, bearing: 0, jump: true, projection: 'mercator' },

  // Polar chapter
  'polar-overview': { center: [0, 90], zoom: 2.5, pitch: 0, bearing: 0, projection: 'globe' },
  'polar-shelf':    { center: [0, 90], zoom: 3.2, pitch: 0, bearing: 0, speed: 0.6, projection: 'globe' },

  // Available for future steps
  'arctic-overview':  { center: [1.558794,    79.96449 ], zoom: 2.3,  speed: alterSpeed, pitch: alterPitch },
  'isfjorden':        { center: [15.066763,   78.349172], zoom: 6.7,  speed: alterSpeed, pitch: alterPitch },
  'kongsfjorden':     { center: [11.918895,   78.931950], zoom: 8.3,  speed: alterSpeed, pitch: alterPitch },
  'young-sound':      { center: [-21.022543,  74.343009], zoom: 7.8,  speed: alterSpeed, pitch: alterPitch },
  'nuuk':             { center: [-50.892017,  64.280048], zoom: 7.7,  speed: alterSpeed, pitch: alterPitch },
  'porsangerfjorden': { center: [25.786149,   70.525686], zoom: 7.3,  speed: alterSpeed, pitch: alterPitch },
  'disko':            { center: [-51.984934,  69.278638], zoom: 6.55, speed: alterSpeed, pitch: alterPitch },
  'greenland-sea':    { center: [-18.123336,  68.135691], zoom: 3.55, speed: alterSpeed, pitch: alterPitch },
  'laptev-sea':       { center: [125.723552,  74.594426], zoom: 3.85, speed: alterSpeed, pitch: alterPitch },
  'chukchi-sea':      { center: [-171.974262, 69.589304], zoom: 4.2,  speed: alterSpeed, pitch: alterPitch },
  'baffin-bay':       { center: [-67.800772,  74.206607], zoom: 3,    speed: alterSpeed, pitch: alterPitch },
  'barents-sea':      { center: [37.533459,   72.728405], zoom: 3.6,  speed: alterSpeed, pitch: alterPitch },
  'east-siberian-sea':{ center: [162.250417,  72.365280], zoom: 4,    speed: alterSpeed, pitch: alterPitch },
  'beaufort-sea':     { center: [-141.148989, 71.841302], zoom: 4,    speed: alterSpeed, pitch: alterPitch },
};

// ── Arctic country highlights ─────────────────────────────────────────────────

// ISO codes for countries surrounding the Arctic
const ARCTIC_COUNTRIES = ["RU", "CA", "NO", "GL", "IS", "US", "SJ"];

// ── Country name labels ───────────────────────────────────────────────────────

const ARCTIC_LABELS = [
  { iso: "RU", name: "RUSSIA",        longitude: 96,   latitude: 66 },
  { iso: "CA", name: "CANADA",        longitude: -96,  latitude: 66 },
  { iso: "GL", name: "GREENLAND",     longitude: -42,  latitude: 74 },
  { iso: "NO", name: "NORWAY",        longitude: 14,   latitude: 66 },
  { iso: "IS", name: "ICELAND",       longitude: -18,  latitude: 65 },
  { iso: "US", name: "UNITED STATES", longitude: -153, latitude: 64 },
];

// ── Static GeoJSON shapes ─────────────────────────────────────────────────────

// Semi-transparent fill covering 60°N and above to highlight the Arctic Ocean
const ARCTIC_OCEAN_GEOJSON = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-180, 60],
      [ 180, 60],
      [ 180, 89.9],
      [-180, 89.9],
      [-180, 60],
    ]],
  },
};

// ── Country quiz ─────────────────────────────────────────────────────────────

// The 6 countries the user must identify in the quiz
const QUIZ_COUNTRIES = [
  { iso: "RU", name: "Russia",        color: "#1565C0" },
  { iso: "CA", name: "Canada",        color: "#D32F2F" },
  { iso: "NO", name: "Norway",        color: "#E65100" },
  { iso: "GL", name: "Greenland",     color: "#2E7D32" },
  { iso: "IS", name: "Iceland",       color: "#6A1B9A" },
  { iso: "US", name: "United States", color: "#AD1457" },
];

// Builds a Mapbox match expression: found countries show their colour, others are dimmed
function buildQuizColorExpr(found) {
  const entries = QUIZ_COUNTRIES.flatMap(({ iso, color }) => {
    const c = found.has(iso) ? color : "#444";
    return iso === "NO"
      ? ["NO", c, "SJ", c]   // Svalbard matches Norway
      : [iso, c];
  });
  return ["match", ["get", "iso_3166_1"], ...entries, "transparent"];
}

// Found countries are visible; unfound are fully transparent (still clickable in Mapbox)
function buildQuizOpacityExpr(found) {
  const entries = QUIZ_COUNTRIES.flatMap(({ iso }) => {
    const op = found.has(iso) ? 0.6 : 0;
    return iso === "NO" ? ["NO", op, "SJ", op] : [iso, op];
  });
  return ["match", ["get", "iso_3166_1"], ...entries, 0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewMap({ cameraKey, quizMode, embed = false, hideGlobeToggle = false, initialViewState, mapRevealed = false, onFlyOutComplete, cogUrl, cogYear, cogOpacity = 0, cogVmin = -3, cogVmax = 3, useLightStyle = false }) {
  const temperatureMapActive = cogUrl && cogOpacity > 0.3;
  const targetMapStyle = (useLightStyle || temperatureMapActive) ? TEMPERATURE_MAP_STYLE : SATELLITE_MAP_STYLE;

  const mapRef            = useRef(null);
  const resizeObserverRef = useRef(null);
  const coastlineAnimRef  = useRef(null);
  const rotateRef         = useRef(null);
  const flyOutTimerRef    = useRef(null);
  const introTimerRef     = useRef(null);
  const styleReadyTimerRef = useRef(null);
  const flyOutFiredRef    = useRef(false);
  const onFlyOutCompleteRef = useRef(onFlyOutComplete);

  // COG temperature layer
  const cogCacheRef = useRef(new window.Map());
  const cogSlotRef  = useRef('a');
  const cogReqRef   = useRef(0);
  const cogReadyRef = useRef(false);
  const cogInFlightRef = useRef(new window.Map());
  const [cogLayer,  setCogLayer] = useState(null);

  const [isGlobe, setIsGlobe]                   = useState(false);
  const [styleLoaded, setStyleLoaded]           = useState(false);
  const [globeClicked, setGlobeClicked]         = useState(false);
  const [appliedMapStyle, setAppliedMapStyle]   = useState(targetMapStyle);

  // Quiz: which ISO codes the user has clicked so far
  const [quizFound, setQuizFound] = useState(new Set());
  // Ref lets the click-handler closure always read the latest set without re-binding
  const quizFoundRef = useRef(new Set());

  useEffect(() => {
    onFlyOutCompleteRef.current = onFlyOutComplete;
  }, [onFlyOutComplete]);

  const loadCogYear = useCallback((year) => {
    if (!cogUrl) return Promise.reject(new Error('Missing COG URL template'));
    const yr = snapCogYear(year);
    const cache = cogCacheRef.current;
    const inFlight = cogInFlightRef.current;
    if (cache.has(yr)) return Promise.resolve(cache.get(yr));
    if (inFlight.has(yr)) return inFlight.get(yr);
    const request = decodeCOG(cogUrl(yr), cogVmin, cogVmax)
      .then(result => {
        cache.set(yr, result);
        inFlight.delete(yr);
        return result;
      })
      .catch(error => {
        inFlight.delete(yr);
        throw error;
      });
    inFlight.set(yr, request);
    return request;
  }, [cogUrl, cogVmin, cogVmax]);

  useEffect(() => {
    if (appliedMapStyle === targetMapStyle) return;
    const t = setTimeout(() => {
      setStyleLoaded(false);
      setAppliedMapStyle(targetMapStyle);
    }, 0);
    return () => clearTimeout(t);
  }, [appliedMapStyle, targetMapStyle]);

  // ── Scroll-driven camera ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !styleLoaded) return;

    // Cancel any running animations
    if (rotateRef.current) {
      cancelAnimationFrame(rotateRef.current);
      rotateRef.current = null;
    }
    if (coastlineAnimRef.current) {
      cancelAnimationFrame(coastlineAnimRef.current);
      coastlineAnimRef.current = null;
    }

    // ── Camera ──────────────────────────────────────────────────────────────
    let onMoveEnd = null;
    if (cameraKey === 'intro-globe') {
      map.setProjection('globe');
      map.jumpTo({ center: [20, 78], zoom: 1.5, pitch: 20, bearing: 0 });
      const rotate = () => {
        map.setBearing((map.getBearing() + 0.06) % 360);
        rotateRef.current = requestAnimationFrame(rotate);
      };
      rotateRef.current = requestAnimationFrame(rotate);
    } else if (cameraKey === 'greenland-glaciers' && embed) {
      map.setProjection('globe');
      map.flyTo({ center: [-41, 74], zoom: 3, pitch: 0, bearing: 0, duration: 1200 });
      onMoveEnd = () => map.flyTo(CAMERAS['greenland-glaciers']);
      map.once('moveend', onMoveEnd);
    } else if (CAMERAS[cameraKey] && cameraKey !== 'intro-arctic') {
      const cam = CAMERAS[cameraKey];
      map.setProjection(cam.projection ?? (cam.jump ? 'globe' : 'mercator'));
      if (cam.jump) {
        map.jumpTo(cam);
      } else {
        map.flyTo(cam);
      }
      // 'intro-arctic': initialViewState positions the map; fly-out effect owns all animation
    }

    // ── Coastline draw-on animation ──────────────────────────────────────────
    if (cameraKey === 'arctic-coastline') {
      const hidden = ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,191,255,0)', 1, 'rgba(0,191,255,0)'];
      map.setPaintProperty('arctic-coastline-line', 'line-gradient', hidden);
      map.setPaintProperty('arctic-coastline-glow', 'line-gradient', hidden);
      map.setPaintProperty('arctic-coastline-line', 'line-opacity', 1);
      map.setPaintProperty('arctic-coastline-glow', 'line-opacity', 1);

      const startTime = performance.now();
      const DRAW_DURATION = 4000;

      const animate = (now) => {
        const t = Math.min(1, (now - startTime) / DRAW_DURATION);
        const tail = 0.05;
        const from = Math.max(0, t - tail);

        // When from === 0, omit the redundant first stop so all inputs are strictly ascending.
        const lineStops = from > 0
          ? [0, 'rgba(0,191,255,1)', from, 'rgba(0,191,255,1)', t, 'rgba(0,191,255,0)', 1, 'rgba(0,191,255,0)']
          : [0, 'rgba(0,191,255,1)',                             t, 'rgba(0,191,255,0)', 1, 'rgba(0,191,255,0)'];
        const glowStops = from > 0
          ? [0, 'rgba(0,191,255,0.3)', from, 'rgba(0,191,255,0.3)', t, 'rgba(0,191,255,0)', 1, 'rgba(0,191,255,0)']
          : [0, 'rgba(0,191,255,0.3)',                               t, 'rgba(0,191,255,0)', 1, 'rgba(0,191,255,0)'];

        map.setPaintProperty('arctic-coastline-line', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], ...lineStops]);
        map.setPaintProperty('arctic-coastline-glow', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], ...glowStops]);

        if (t < 1) coastlineAnimRef.current = requestAnimationFrame(animate);
        else coastlineAnimRef.current = null;
      };

      coastlineAnimRef.current = requestAnimationFrame(animate);
    } else {
      map.setPaintProperty('arctic-coastline-line', 'line-opacity', 0);
      map.setPaintProperty('arctic-coastline-glow', 'line-opacity', 0);
    }

    return () => {
      if (onMoveEnd) map.off('moveend', onMoveEnd);
      if (rotateRef.current) {
        cancelAnimationFrame(rotateRef.current);
        rotateRef.current = null;
      }
      if (coastlineAnimRef.current) {
        cancelAnimationFrame(coastlineAnimRef.current);
        coastlineAnimRef.current = null;
      }
      if (flyOutTimerRef.current) {
        clearTimeout(flyOutTimerRef.current);
        flyOutTimerRef.current = null;
      }
    };
  }, [cameraKey, embed, styleLoaded]);

  // ── Intro fly-out: fires exactly once when map is ready and revealed ─────
  useEffect(() => {
    if (flyOutFiredRef.current) return;
    if (!mapRevealed || !styleLoaded || cameraKey !== 'intro-arctic') return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    flyOutFiredRef.current = true;
    const FLY_DURATION = 9000;
    map.stop();  // cancel any pending animation before starting
    map.flyTo({
      center: [0, 20],
      zoom: 1.0,
      duration: FLY_DURATION,
      pitch: 0,
      bearing: 0,
      easing: introFlyEasing,
      essential: true,
    });
    introTimerRef.current = setTimeout(() => onFlyOutCompleteRef.current?.(), FLY_DURATION + 200);
    return () => {
      clearTimeout(introTimerRef.current);
    };
  }, [mapRevealed, styleLoaded, cameraKey]);

  // ── COG temperature layer: pre-load all years in background ──────────────
  useEffect(() => {
    if (!cogUrl) return;
    let cancelled = false;
    const run = async () => {
      let nextIndex = 0;
      const worker = async () => {
        while (!cancelled && nextIndex < COG_YEARS.length) {
          const year = COG_YEARS[nextIndex++];
          await loadCogYear(year).catch(() => {});
        }
      };
      await Promise.all([worker(), worker()]);
    };
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cogUrl, loadCogYear]);

  // ── COG temperature layer: pre-fetch neighbours for smoother slider drag ──
  useEffect(() => {
    if (!cogUrl || cogYear == null) return;
    const yr = snapCogYear(cogYear);
    [yr - 10, yr + 10, 2025]
      .filter(year => year >= 1880 && year <= 2025)
      .forEach(year => {
        loadCogYear(year).catch(() => {});
      });
  }, [cogUrl, cogYear, loadCogYear]);

  // ── COG temperature layer: decode + swap slots on year change ────────────
  useEffect(() => {
    if (!cogUrl || cogYear == null || !styleLoaded) return;
    const id = ++cogReqRef.current;
    const yr = snapCogYear(cogYear);
    loadCogYear(yr).then(result => {
      if (id !== cogReqRef.current) return;
      if (!cogReadyRef.current) {
        setCogLayer(result);
        cogReadyRef.current = true;
        return;
      }
      const map = mapRef.current?.getMap();
      if (!map?.isStyleLoaded()) return;
      const next = cogSlotRef.current === 'a' ? 'b' : 'a';
      const prev = cogSlotRef.current;
      if (!hasCogLayer(map, next) || !hasCogLayer(map, prev)) {
        setCogLayer(result);
        cogSlotRef.current = 'a';
        return;
      }
      map.getSource(`cog-${next}`).updateImage({ url: result.dataUrl, coordinates: result.coordinates });
      map.setPaintProperty(`cog-raster-${next}`, 'raster-opacity-transition', { duration: 300, delay: 0 });
      map.setPaintProperty(`cog-raster-${next}`, 'raster-opacity', cogOpacity);
      map.setPaintProperty(`cog-raster-${prev}`, 'raster-opacity-transition', { duration: 300, delay: 0 });
      map.setPaintProperty(`cog-raster-${prev}`, 'raster-opacity', 0);
      cogSlotRef.current = next;
    }).catch(() => {});
  }, [cogYear, cogUrl, styleLoaded, cogOpacity, loadCogYear]);

  // ── COG temperature layer: fade in/out when cogOpacity changes ────────────
  useEffect(() => {
    if (!styleLoaded || !cogLayer) return;
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    const activeSlot = cogSlotRef.current;
    if (!hasCogLayer(map, activeSlot)) return;
    map.setPaintProperty(`cog-raster-${activeSlot}`, 'raster-opacity-transition', { duration: 800, delay: 0 });
    map.setPaintProperty(`cog-raster-${activeSlot}`, 'raster-opacity', cogOpacity);
  }, [cogOpacity, styleLoaded, cogLayer]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      clearTimeout(styleReadyTimerRef.current);
    };
  }, []);

  // ── Map load ───────────────────────────────────────────────────────────────
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const observer = new ResizeObserver(() => mapRef.current?.getMap().resize());
    observer.observe(map.getContainer());
    resizeObserverRef.current = observer;

    map.on('error', ({ error }) => {
      if (error?.status === 404) return;
      console.error(error);
    });

  }, []);

  const handleStyleReady = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map?.loaded() || !map.isStyleLoaded()) return;
    clearTimeout(styleReadyTimerRef.current);
    styleReadyTimerRef.current = setTimeout(() => {
      const readyMap = mapRef.current?.getMap();
      if (readyMap?.loaded() && readyMap.isStyleLoaded()) {
        setStyleLoaded(true);
      }
    }, 0);
  }, []);

  // ── Quiz: pointer cursor when hovering over countries ─────────────────────
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !styleLoaded || !quizMode) return;
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { map.getCanvas().style.cursor = ''; };
    map.on('mouseenter', 'arctic-countries-fill', onEnter);
    map.on('mouseleave', 'arctic-countries-fill', onLeave);
    return () => {
      map.off('mouseenter', 'arctic-countries-fill', onEnter);
      map.off('mouseleave', 'arctic-countries-fill', onLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [quizMode, styleLoaded]);

  // ── Quiz: handle country click via react-map-gl's onClick ─────────────────
  // Paint is driven reactively through the Layer components below — no setPaintProperty needed.
  const handleMapClick = useCallback((e) => {
    if (!quizMode) return;
    const iso = e.features?.[0]?.properties?.iso_3166_1;
    if (!iso) return;
    const target = iso === 'SJ' ? 'NO' : iso;
    if (!QUIZ_COUNTRIES.find(c => c.iso === target)) return;
    if (quizFoundRef.current.has(target)) return;
    const next = new Set([...quizFoundRef.current, target]);
    quizFoundRef.current = next;
    setQuizFound(new Set(next));
    track('quiz_click', { iso: target, total_found: next.size, complete: next.size === QUIZ_COUNTRIES.length });
  }, [quizMode]);

  const tempWashOpacity = temperatureMapActive ? Math.min(0.18, cogOpacity * 0.25) : 0;
  const showTemperatureLegend = cogUrl && cogOpacity > 0.05;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={initialViewState ?? { latitude: 0, longitude: 1.558794, zoom: 0 }}
      projection="mercator"
      mapStyle={appliedMapStyle}
      style={{
        width: "100%",
        height: "100%",
      }}
      onLoad={handleMapLoad}
      onIdle={handleStyleReady}
      interactiveLayerIds={quizMode ? ['arctic-countries-hit'] : []}
      onClick={handleMapClick}
      scrollZoom={!embed}
      doubleClickZoom={!embed}
      touchZoomRotate={!embed}
      dragPan={!embed}
    >

      {/* ── Quiz overlay panel ─────────────────────────────────────────────── */}
      {quizMode && (
        <div style={{
          position:       'absolute',
          top:            16,
          left:           16,
          zIndex:         10,
          background:     'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
          borderRadius:   12,
          padding:        '14px 18px',
          color:          '#fff',
          width:          210,
          boxShadow:      '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {quizFound.size < QUIZ_COUNTRIES.length ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.35 }}>
                Which countries border the Arctic Ocean?
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>
                Click each country on the map
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {QUIZ_COUNTRIES.map(({ iso, name, color }) => {
                  const found = quizFound.has(iso);
                  return (
                    <div key={iso} style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        8,
                      opacity:    found ? 1 : 0.38,
                      transition: 'opacity 400ms ease',
                    }}>
                      <div style={{
                        width:      10,
                        height:     10,
                        borderRadius: '50%',
                        background: found ? color : '#666',
                        flexShrink: 0,
                        transition: 'background 400ms ease, box-shadow 400ms ease',
                        boxShadow:  found ? `0 0 7px ${color}` : 'none',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: found ? 600 : 400, flex: 1 }}>
                        {found ? name : '???'}
                      </span>
                      {found && (
                        <span style={{ fontSize: 11, color: '#4caf50' }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, color: '#666', marginTop: 10, textAlign: 'right' }}>
                {quizFound.size} / {QUIZ_COUNTRIES.length}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>All 6 found!</div>
              <div style={{ fontSize: 16, color: '#aaa', lineHeight: 1.5 }}>
                Russia, Canada, Norway, Greenland, Iceland and the United States all share a coastline
                with the Arctic Ocean.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Globe toggle — disappears after switching ──────────────────────── */}
      {!isGlobe && !embed && !hideGlobeToggle && (
        <div style={{
          height:    40,
          width:     'fit-content',
          position:  'absolute',
          bottom:    24,
          left:      '50%',
          transform: 'translateX(-50%)',
          zIndex:    10,
        }}>
          <button
            onClick={() => {
              const map = mapRef.current?.getMap();
              if (!map) return;
              setGlobeClicked(true);
              track('globe_toggle');
              map.setProjection('globe');
              setIsGlobe(true);
              map.flyTo({ center: [0, 85], zoom: 2.7, pitch: 0, bearing: 0, duration: 5000 });
            }}
            style={{
              padding:        '8px 18px',
              borderRadius:   30,
              border:         '1px solid rgba(255,255,255,0.4)',
              background:     'rgba(0,0,0,0.55)',
              color:          '#fff',
              fontSize:       20,
              fontWeight:     600,
              letterSpacing:  '0.05em',
              cursor:         'pointer',
              backdropFilter: 'blur(6px)',
              animation:      !globeClicked ? 'dragPulse 1.4s ease-in-out infinite' : 'none',
            }}
          >
            🌍 View the Arctic from above
          </button>
        </div>
      )}

      {showTemperatureLegend && (
        <div style={{
          position:             'absolute',
          top:                  16,
          right:                16,
          zIndex:               10,
          width:                230,
          padding:              '11px 14px 10px',
          borderRadius:         8,
          background:           'rgba(255,255,255,0.9)',
          backdropFilter:       'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow:            '0 2px 12px rgba(0,0,0,0.16)',
          color:                '#1d2b36',
          pointerEvents:        'none',
          opacity:              Math.min(1, cogOpacity * 1.6),
          transition:           'opacity 700ms ease',
        }}>
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'baseline',
            gap:            12,
            marginBottom:   7,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Temperature anomaly</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(cogYear ?? 1880)}
            </span>
          </div>
          <div style={{
            width:        '100%',
            height:       9,
            borderRadius: 999,
            background:   'linear-gradient(to right, #313695, #74add1, #f6f4e8, #fdae61, #a50026)',
            marginBottom: 5,
          }} />
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            fontSize:       10,
            color:          '#435363',
          }}>
            <span>{cogVmin}°C</span>
            <span>0</span>
            <span>+{cogVmax}°C</span>
          </div>
        </div>
      )}

      {styleLoaded && <>

        {/* Soft white wash: fades the satellite basemap back as temperature anomalies fade in. */}
        {cogUrl && (
          <Layer
            id="temperature-basemap-wash"
            type="background"
            paint={{
              "background-color": "#f8faf7",
              "background-opacity": tempWashOpacity,
              "background-opacity-transition": { duration: 900, delay: 0 },
            }}
          />
        )}

        {/* Coloured fill and border for each Arctic country.
            In quiz mode paint is driven by quizFound state — colours only appear after clicking. */}
        <Source id="country-boundaries" type="vector" url="mapbox://mapbox.country-boundaries-v1">
          <Layer
            id="arctic-countries-fill"
            type="fill"
            source-layer="country_boundaries"
            filter={["in", "iso_3166_1", ...ARCTIC_COUNTRIES]}
            paint={{
              "fill-color":   buildQuizColorExpr(quizFound),
              "fill-opacity": quizMode ? buildQuizOpacityExpr(quizFound) : 0,
            }}
          />
          <Layer
            id="arctic-countries-border"
            type="line"
            source-layer="country_boundaries"
            filter={["in", "iso_3166_1", ...ARCTIC_COUNTRIES]}
            paint={{
              "line-color":   buildQuizColorExpr(quizFound),
              "line-width":   1.5,
              "line-opacity": quizMode ? buildQuizOpacityExpr(quizFound) : 0,
            }}
          />
          {/* Hit-area layer: fill-opacity 0 blocks queryRenderedFeatures, so we keep a
              near-invisible fill solely for click detection during quiz mode. */}
          <Layer
            id="arctic-countries-hit"
            type="fill"
            source-layer="country_boundaries"
            filter={["in", "iso_3166_1", ...ARCTIC_COUNTRIES]}
            paint={{
              "fill-color":   "white",
              "fill-opacity": quizMode ? 0.01 : 0,
            }}
          />
        </Source>
        

        {/* Country name labels — only shown in quiz mode, and only once the country is found */}
        {quizMode && ARCTIC_LABELS.filter(l => quizFound.has(l.iso)).map(({ name, longitude, latitude }) => (
          <Marker key={name} longitude={longitude} latitude={latitude} anchor="center">
            <div style={{
              color:         '#ffffff',
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: '0.12em',
              whiteSpace:    'nowrap',
              pointerEvents: 'none',
              textShadow:    '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)',
            }}>
              {name}
            </div>
          </Marker>
        ))}

        {/* Bathymetry depth bands — polar chapter */}
        <Source id="bathymetry" type="geojson" data={`${BASE}Final_depth_map.geojson`}>
          <Layer
            id="bathymetry-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match", ["get", "depth"],
                  //   5000, "#0d2a5c",
                  //  4000, "#1a3f7a",
                  //  3000, "#1d5f9e",
                  //  2000, "#2980b9",
                  //  1000, "#5baed6",
                  //  200, "#89c5e8",
                   0, "#fffae1",
                    "hsla(100, 23%, 98%, 0.00)"
              ],
              "fill-opacity": ['polar-overview', 'polar-shelf'].includes(cameraKey) ? 0.20 : 0,
            }}
          />
        </Source>

        {/* 200 m depth contour — drawn on via line-gradient animation when camera enters */}
        <Source id="arctic-coastline" type="geojson" data={`${BASE}arctic-ocean-coastline.geojson`} lineMetrics={true}>
          <Layer
            id="arctic-coastline-glow"
            type="line"
            paint={{
              "line-color":   "#00bfff",
              "line-width":   2,
              "line-opacity": 0,
              "line-blur":    0.60,
            }}
          />
          <Layer
            id="arctic-coastline-line"
            type="line"
            paint={{
              "line-color":   "#00bfff",
              "line-width":   1,
              "line-opacity": 0,
            }}
          />
        </Source>

        {/* Glacier retreat lines — only visible on the greenland-glaciers camera */}
        <Source id="glacier-retreat" type="geojson" data={`${BASE}Glacier_retreat_greenland.geojson`}>
          <Layer
            id="glacier-retreat-line"
            type="line"
            paint={{
              "line-color": [
                "interpolate", ["linear"], ["get", "Year"],
                1973, "#ffff00",
                2019, "#ff0000",
              ],
              "line-width":   1.2,
              "line-opacity": ['greenland-glaciers', 'greenland-overview'].includes(cameraKey) ? 0.8 : 0,
            }}
          />
        </Source>

        {/* COG temperature anomaly — two-slot crossfade, opacity driven by parent */}
        {cogLayer && <>
          <Source id="cog-a" type="image" url={cogLayer.dataUrl} coordinates={cogLayer.coordinates}>
            <Layer id="cog-raster-a" type="raster" paint={{ 'raster-opacity': 0 }} />
          </Source>
          <Source id="cog-b" type="image" url={cogLayer.dataUrl} coordinates={cogLayer.coordinates}>
            <Layer id="cog-raster-b" type="raster" paint={{ 'raster-opacity': 0 }} />
          </Source>
        </>}

      </>}

    </Map>
  );
}
