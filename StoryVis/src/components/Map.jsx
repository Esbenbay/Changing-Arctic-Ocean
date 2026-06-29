import { Map, Layer, Source, Marker } from "react-map-gl/mapbox";
import { memo, useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
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

const disableTerrainSafely = (map) => {
  try {
    map?.setTerrain?.(null);
  } catch {
    return undefined;
  }
};

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

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const BASE  = import.meta.env.BASE_URL;
const SATELLITE_MAP_STYLE = "mapbox://styles/mapbox/standard-satellite";
const TEMPERATURE_MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const COG_YEARS = [...Array.from({ length: 15 }, (_, i) => 1880 + i * 10), 2025];

const alterSpeed = 0.8;
const alterPitch = 2;
const introFlyEasing = t => t * t * (3 - 2 * t);
const COMPLETION_OVERLAY_FADE_MS = 4000;
const COMPLETION_OVERLAY_LEAD_MS = 1400;

const snapCogYear = year =>
  Math.max(1880, Math.min(2025, Math.round(year / 10) * 10));

const getMapSizeMode = ({ width, height }) => ({
  compact: width < 620 || height < 500,
  tiny: width < 430 || height < 370,
  short: height < 430,
});

const getResponsiveCamera = (key, cam, mapSize, embed) => {
  const { compact, tiny, short } = getMapSizeMode(mapSize);
  if (!cam) return cam;

  let zoomOffset = 0;
  if (tiny) zoomOffset -= 0.45;
  else if (compact) zoomOffset -= 0.24;
  else if (short) zoomOffset -= 0.16;

  if (['svalbard', 'greenland-glaciers'].includes(key)) {
    zoomOffset += tiny ? -0.28 : compact ? -0.18 : 0;
  } else if (['polar-overview', 'polar-shelf', 'arctic-coastline', 'arctic-quiz'].includes(key)) {
    zoomOffset += tiny ? -0.12 : 0;
  } else if (key === 'global-temp') {
    zoomOffset += tiny ? -0.22 : compact ? -0.12 : 0;
  } else if (key === 'world-overview') {
    zoomOffset += tiny ? -0.06 : 0;
  }

  const zoom = typeof cam.zoom === 'number'
    ? Math.max(0.4, cam.zoom + zoomOffset)
    : cam.zoom;
  const speed = cam.speed && (compact || embed)
    ? Math.max(0.35, cam.speed * 0.88)
    : cam.speed;

  return {
    ...cam,
    zoom,
    speed,
  };
};

const CAMERAS = {
  'arctic-quiz':    { center: [0, 85], zoom: 2.7,    speed: alterSpeed, pitch: 0, bearing: 0, projection: 'globe' },
  'world-overview': { center: [0,           20      ], zoom: 1, pitch: 0, bearing: 0, projection: 'mercator' },
  'svalbard':       { center: [16.57969, 77.82355], zoom: 9.508, duration: 5200, projection: 'globe' },
  'canada-arctic':  { center: [-99.214076,  73.476835], zoom: 3.7,  speed: alterSpeed, pitch: alterPitch, projection: 'globe' },
  'arctic-coastline':  { center: [0, 90], zoom: 2.6,    speed: alterSpeed, pitch: 0 , projection: 'globe'    },
  'greenland-overview':  { center: [-42, 72],              zoom: 3, speed: alterSpeed, pitch: alterPitch },
  'greenland-glaciers':  { center: [-41.338798, 64.249670], zoom: 9, speed: alterSpeed, pitch: alterPitch },
  'intro-arctic':   { center: [16.57969, 77.82355], zoom: 9.508,  pitch: 0, bearing: 0, jump: true, projection: 'mercator' },
  'global-temp':    { center: [0, 22], zoom: 0.55, pitch: 0, bearing: 0, jump: true, projection: 'mercator' },
  'polar-overview': { center: [0, 90], zoom: 2.5, pitch: 0, bearing: 0, projection: 'globe' },
  'polar-shelf':    { center: [0, 90], zoom: 2.6, pitch: 0, bearing: 0, speed: 0.6, projection: 'globe' },
  'arctic-overview':  { center: [1.558794,    79.96449 ], zoom: 2.3,  speed: alterSpeed, pitch: alterPitch },
};

const ARCTIC_COUNTRIES = ["RU", "CA", "NO", "GL", "IS", "US", "SJ"];

const ARCTIC_LABELS = [
  { iso: "RU", name: "RUSSIA",        longitude: 96,   latitude: 66 },
  { iso: "CA", name: "CANADA",        longitude: -96,  latitude: 66 },
  { iso: "GL", name: "GREENLAND",     longitude: -42,  latitude: 74 },
  { iso: "NO", name: "NORWAY",        longitude: 14,   latitude: 66 },
  { iso: "IS", name: "ICELAND",       longitude: -18,  latitude: 65 },
  { iso: "US", name: "UNITED STATES", longitude: -153, latitude: 64 },
];

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

const QUIZ_COUNTRIES = [
  { iso: "RU", name: "Russia",        color: "#1565C0" },
  { iso: "CA", name: "Canada",        color: "#D32F2F" },
  { iso: "NO", name: "Norway",        color: "#E65100" },
  { iso: "GL", name: "Greenland",     color: "#2E7D32" },
  { iso: "IS", name: "Iceland",       color: "#6A1B9A" },
  { iso: "US", name: "United States", color: "#AD1457" },
];


function buildQuizColorExpr(found) {
  const entries = QUIZ_COUNTRIES.flatMap(({ iso, color }) => {
    const c = found.has(iso) ? color : "#444";
    return iso === "NO"
      ? ["NO", c, "SJ", c]
      : [iso, c];
  });
  return ["match", ["get", "iso_3166_1"], ...entries, "transparent"];
}


function buildQuizOpacityExpr(found) {
  const entries = QUIZ_COUNTRIES.flatMap(({ iso }) => {
    const op = found.has(iso) ? 0.6 : 0;
    return iso === "NO" ? ["NO", op, "SJ", op] : [iso, op];
  });
  return ["match", ["get", "iso_3166_1"], ...entries, 0];
}

export default memo(function NewMap({ cameraKey, quizMode, bathymetryMode, completionOverlayImage, embed = false, hideGlobeToggle = false, initialViewState, mapRevealed = false, introFlyTriggered = false, onFlyOutComplete, cogUrl, cogYear, cogOpacity = 0, cogFadeDuration = 250, cogVmin = -3, cogVmax = 3, useLightStyle = false }) {
  const temperatureMapActive = cogUrl && cogOpacity > 0.3;
  const targetMapStyle = useLightStyle ? TEMPERATURE_MAP_STYLE : SATELLITE_MAP_STYLE;

  const mapRef            = useRef(null);
  const coastlineAnimRef  = useRef(null);
  const rotateRef         = useRef(null);
  const flyOutTimerRef    = useRef(null);
  const flyOutFiredRef    = useRef(false);
  const onFlyOutCompleteRef = useRef(onFlyOutComplete);
  const resizeFrameRef    = useRef(null);
  const globeRequestAppliedRef = useRef(false);

  const cogCacheRef = useRef(new window.Map());
  const cogSlotRef  = useRef('a');
  const cogReqRef   = useRef(0);
  const cogReadyRef = useRef(false);
  const cogInFlightRef = useRef(new window.Map());
  const [cogLayer,     setCogLayer]     = useState(null);
  const [slotAOpacity, setSlotAOpacity] = useState(0);
  const [slotBOpacity, setSlotBOpacity] = useState(0);

  const [isGlobe, setIsGlobe]                   = useState(false);
  const [styleLoaded, setStyleLoaded]           = useState(false);
  const [globeClicked, setGlobeClicked]         = useState(false);
  const [globeRequested, setGlobeRequested]     = useState(false);
  const [cleanupResources, setCleanupResources] = useState(null);
  const [appliedMapStyle, setAppliedMapStyle]   = useState(targetMapStyle);
  const [shelfPulse, setShelfPulse]             = useState(false);
  const [completionOverlayVisible, setCompletionOverlayVisible] = useState(false);
  const [mapSize, setMapSize] = useState(() => ({
    width:  window.innerWidth,
    height: window.innerHeight,
  }));

  const [quizFound, setQuizFound] = useState(new Set());
  const quizFoundRef = useRef(new Set());

  useEffect(() => {
    onFlyOutCompleteRef.current = onFlyOutComplete;
  }, [onFlyOutComplete]);

  useEffect(() => {
    if (cameraKey !== 'world-overview') {
      globeRequestAppliedRef.current = false;
      const frame = requestAnimationFrame(() => {
        setGlobeRequested(false);
        setGlobeClicked(false);
        setIsGlobe(false);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [cameraKey]);

  useEffect(() => {
    if (cameraKey !== 'polar-shelf' || bathymetryMode !== 'shelf') {
      const frame = requestAnimationFrame(() => setShelfPulse(false));
      return () => cancelAnimationFrame(frame);
    }
    const pulseTimer = setInterval(() => {
      setShelfPulse(value => !value);
    }, 2300);
    return () => clearInterval(pulseTimer);
  }, [bathymetryMode, cameraKey]);

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
      disableTerrainSafely(mapRef.current?.getMap());
     
      cogReadyRef.current = false;
      cogSlotRef.current  = 'a';
      setCogLayer(null);
      setSlotAOpacity(0);
      setSlotBOpacity(0);
      setStyleLoaded(false);
      setAppliedMapStyle(targetMapStyle);
    }, 0);
    return () => clearTimeout(t);
  }, [appliedMapStyle, targetMapStyle]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !styleLoaded) return;
    const resetOverlayFrame = requestAnimationFrame(() => setCompletionOverlayVisible(false));

    if (rotateRef.current) {
      cancelAnimationFrame(rotateRef.current);
      rotateRef.current = null;
    }
    if (coastlineAnimRef.current) {
      cancelAnimationFrame(coastlineAnimRef.current);
      coastlineAnimRef.current = null;
    }

    let onMoveEnd = null;
    let onCompletionMoveEnd = null;
    let completionOverlayTimer = null;
    map.resize();
    if (cameraKey === 'intro-globe') {
      map.setProjection('globe');
      map.jumpTo(getResponsiveCamera('intro-globe', { center: [20, 78], zoom: 1.5, pitch: 20, bearing: 0 }, mapSize, embed));
      const rotate = () => {
        map.setBearing((map.getBearing() + 0.06) % 360);
        rotateRef.current = requestAnimationFrame(rotate);
      };
      rotateRef.current = requestAnimationFrame(rotate);
    } else if (cameraKey === 'greenland-glaciers' && embed) {
      map.setProjection('globe');
      map.flyTo(getResponsiveCamera('greenland-overview', { center: [-41, 74], zoom: 3, pitch: 0, bearing: 0, duration: 1200 }, mapSize, embed));
      onMoveEnd = () => map.flyTo(getResponsiveCamera('greenland-glaciers', CAMERAS['greenland-glaciers'], mapSize, embed));
      map.once('moveend', onMoveEnd);
    } else if (CAMERAS[cameraKey] && cameraKey !== 'intro-arctic') {
      const cam = getResponsiveCamera(cameraKey, CAMERAS[cameraKey], mapSize, embed);
      map.setProjection(cam.projection ?? (cam.jump ? 'globe' : 'mercator'));
      if (cam.jump) {
        map.jumpTo(cam);
        if (completionOverlayImage) {
          requestAnimationFrame(() => setCompletionOverlayVisible(true));
        }
      } else {
        map.flyTo(cam);
        if (completionOverlayImage) {
          if (cam.duration) {
            completionOverlayTimer = setTimeout(() => {
              setCompletionOverlayVisible(true);
            }, Math.max(0, cam.duration - COMPLETION_OVERLAY_LEAD_MS));
          } else {
            onCompletionMoveEnd = () => setCompletionOverlayVisible(true);
            map.once('moveend', onCompletionMoveEnd);
          }
        }
      }
    }

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
      if (onCompletionMoveEnd) map.off('moveend', onCompletionMoveEnd);
      cancelAnimationFrame(resetOverlayFrame);
      clearTimeout(completionOverlayTimer);
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
  }, [cameraKey, completionOverlayImage, embed, mapSize, styleLoaded]);

  useEffect(() => {
    if (flyOutFiredRef.current) return;
    if (!mapRevealed || !introFlyTriggered || !styleLoaded || cameraKey !== 'intro-arctic') return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    flyOutFiredRef.current = true;
    const FLY_DURATION = 8000;
    const targetCamera = getResponsiveCamera('global-temp', CAMERAS['global-temp'], mapSize, embed);
    const introFlyZoom = Math.min(1.12, targetCamera.zoom + 0.40);
    map.stop();
    map.setProjection(targetCamera.projection ?? 'mercator');
    map.flyTo({
      center: targetCamera.center,
      zoom: introFlyZoom,
      duration: FLY_DURATION,
      pitch: targetCamera.pitch ?? 0,
      bearing: targetCamera.bearing ?? 0,
      easing: introFlyEasing,
      essential: true,
    });

    flyOutTimerRef.current = setTimeout(() => onFlyOutCompleteRef.current?.(), FLY_DURATION + 200);
    return () => {
      if (flyOutTimerRef.current) {
        clearTimeout(flyOutTimerRef.current);
        flyOutTimerRef.current = null;
      }
    };
  }, [mapRevealed, introFlyTriggered, styleLoaded, cameraKey, mapSize, embed]);

  useEffect(() => {
    if (!cogUrl || cogOpacity <= 0.05) return undefined;
    let cancelled = false;
    let timeoutId = null;
    let idleId = null;
    let nextIndex = 0;

    const schedule = (delay = 2200) => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        const run = async () => {
          if (cancelled || document.visibilityState === 'hidden') return;
          while (nextIndex < COG_YEARS.length && cogCacheRef.current.has(COG_YEARS[nextIndex])) {
            nextIndex += 1;
          }
          const year = COG_YEARS[nextIndex];
          if (year == null) return;
          nextIndex += 1;
          await loadCogYear(year).catch(() => {});
          schedule(900);
        };

        if ('requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(run, { timeout: 3500 });
        } else {
          run();
        }
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [cogOpacity, cogUrl, loadCogYear]);

  useEffect(() => {
    if (!cogUrl || cogYear == null) return;
    const yr = snapCogYear(cogYear);
    [yr - 10, yr + 10, 2025]
      .filter(year => year >= 1880 && year <= 2025)
      .forEach(year => {
        loadCogYear(year).catch(() => {});
      });
  }, [cogUrl, cogYear, loadCogYear]);

  useEffect(() => {
    if (!cogUrl || cogYear == null || !styleLoaded) return;
    const id = ++cogReqRef.current;
    const yr = snapCogYear(cogYear);
    loadCogYear(yr).then(result => {
      if (id !== cogReqRef.current) return;
      if (!cogReadyRef.current) {
       
        cogReadyRef.current = true;
        setCogLayer(result);
        setSlotBOpacity(0);
        setSlotAOpacity(0);
        requestAnimationFrame(() => {
          if (id === cogReqRef.current) setSlotAOpacity(cogOpacity);
        });
        return;
      }
      const map = mapRef.current?.getMap();
      if (!map?.isStyleLoaded()) return;
      const next = cogSlotRef.current === 'a' ? 'b' : 'a';
      const prev = cogSlotRef.current;
      if (!hasCogLayer(map, next) || !hasCogLayer(map, prev)) {
        setCogLayer(result);
        cogSlotRef.current = 'a';
        setSlotAOpacity(cogOpacity);
        setSlotBOpacity(0);
        return;
      }
      map.getSource(`cog-${next}`).updateImage({ url: result.dataUrl, coordinates: result.coordinates });
      cogSlotRef.current = next;
      if (next === 'a') { setSlotAOpacity(cogOpacity); setSlotBOpacity(0); }
      else              { setSlotBOpacity(cogOpacity); setSlotAOpacity(0); }
    }).catch(() => {});
  }, [cogYear, cogUrl, styleLoaded, cogOpacity, loadCogYear]);

  useEffect(() => {
    if (!cogLayer) return;
    const frame = requestAnimationFrame(() => {
      const slot = cogSlotRef.current;
      if (slot === 'a') setSlotAOpacity(cogOpacity);
      else              setSlotBOpacity(cogOpacity);
    });
    return () => cancelAnimationFrame(frame);
  }, [cogOpacity, cogLayer]);

 
  useLayoutEffect(() => {
    return () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      disableTerrainSafely(cleanupResources?.map);
      cleanupResources?.observer?.disconnect();
    };
  }, [cleanupResources]);

 
  const handleStyleReady = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map?.isStyleLoaded()) setStyleLoaded(true);
  }, []);

  const requestGlobeView = useCallback(() => {
    globeRequestAppliedRef.current = false;
    setGlobeClicked(true);
    setIsGlobe(true);
    setGlobeRequested(true);
    track('globe_toggle');
  }, []);

  useEffect(() => {
    if (!globeRequested || globeRequestAppliedRef.current) return;
    if (!styleLoaded || cameraKey !== 'world-overview') return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const frame = requestAnimationFrame(() => {
      globeRequestAppliedRef.current = true;
      map.stop();
      map.resize();
      map.setProjection('globe');
      map.flyTo(getResponsiveCamera('polar-shelf', {
        center: [0, 90],
        zoom: 2.6,
        pitch: 0,
        bearing: 0,
        duration: 5000,
        projection: 'globe',
      }, mapSize, embed));
    });

    return () => cancelAnimationFrame(frame);
  }, [cameraKey, embed, globeRequested, mapSize, styleLoaded]);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const container = map.getContainer();
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect || resizeFrameRef.current) return;
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        mapRef.current?.getMap().resize();
        setMapSize({ width: rect.width, height: rect.height });
      });
    });
    observer.observe(container);
    setMapSize({ width: container.clientWidth, height: container.clientHeight });
    setCleanupResources({ map, observer });

    map.on('error', ({ error }) => {
      if (error?.status === 404) return;
    });

    map.on('style.load', () => setStyleLoaded(true));

  }, []);

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
  const showBathymetryLegend = cameraKey === 'polar-shelf' && bathymetryMode === 'full';
  const bathymetryFillOpacity = cameraKey === 'polar-shelf'
    ? (bathymetryMode === 'shelf' ? 0.12 : 0.55)
    : 0;
  const shelfHighlightActive = cameraKey === 'polar-shelf' && bathymetryMode === 'shelf';
  const shelfFillOpacity = shelfHighlightActive
    ? (shelfPulse ? 0.58 : 0.42)
    : ['polar-overview'].includes(cameraKey) ? 0.08 : 0;
  const shelfGlowOpacity = shelfHighlightActive
    ? (shelfPulse ? 0.90 : 0.62)
    : ['polar-overview'].includes(cameraKey) ? 0.10 : 0;
  const shelfEdgeOpacity = shelfHighlightActive
    ? (shelfPulse ? 0.95 : 0.72)
    : ['polar-overview'].includes(cameraKey) ? 0.12 : 0;
  const { compact: mapCompact, tiny: mapTiny } = getMapSizeMode(mapSize);
  const overlayInset = mapTiny ? 8 : mapCompact ? 10 : 16;
  const legendWidth = Math.min(mapTiny ? 168 : mapCompact ? 184 : 230, Math.max(150, mapSize.width - overlayInset * 2));
  const bathymetryLegendWidth = Math.min(mapTiny ? 156 : mapCompact ? 172 : 190, Math.max(140, mapSize.width - overlayInset * 2));
  const overlayPadding = mapTiny ? '8px 9px' : mapCompact ? '9px 11px' : '11px 14px 10px';
  const overlayTitleFont = mapTiny ? 10.5 : mapCompact ? 11 : 12;
  const overlayTextFont = mapTiny ? 9 : mapCompact ? 9.5 : 10;
  const quizPanelWidth = Math.min(mapTiny ? 168 : mapCompact ? 188 : 210, Math.max(150, mapSize.width - overlayInset * 2));
  const quizPanelPadding = mapTiny ? '9px 10px' : mapCompact ? '11px 13px' : '14px 18px';
  const globeFontSize = mapTiny ? 13 : mapCompact ? 15 : 20;
  const globeButtonPadding = mapTiny ? '7px 12px' : mapCompact ? '8px 14px' : '8px 18px';
  const countryLabelFont = mapTiny ? 8.5 : mapCompact ? 9.5 : 11;
  const shelfGlowWidth = shelfHighlightActive ? (mapTiny ? 8 : mapCompact ? 10 : 13) : (mapTiny ? 2.4 : 4);
  const shelfGlowBlur = shelfHighlightActive ? (mapTiny ? 4.5 : mapCompact ? 5.5 : 7) : (mapTiny ? 1 : 1.5);
  const shelfEdgeWidth = shelfHighlightActive ? (mapTiny ? 2 : mapCompact ? 2.6 : 3.2) : 0.6;
  const coastlineGlowWidth = mapTiny ? 1.4 : mapCompact ? 1.7 : 2;
  const coastlineLineWidth = mapTiny ? 0.8 : 1;

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={initialViewState ?? { latitude: 0, longitude: 1, zoom: 1 }}
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
      interactive={!embed}
      scrollZoom={false}
      doubleClickZoom={!embed}
      touchZoomRotate={!embed}
      dragPan={!embed}
      dragRotate={!embed}
      touchPitch={!embed}
      boxZoom={!embed}
      keyboard={!embed}
    >

      {quizMode && (
        <div style={{
          position:       'absolute',
          top:            overlayInset,
          left:           overlayInset,
          zIndex:         10,
          background:     'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
          borderRadius:   mapTiny ? 8 : 12,
          padding:        quizPanelPadding,
          color:          '#fff',
          width:          quizPanelWidth,
          boxShadow:      '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {quizFound.size < QUIZ_COUNTRIES.length ? (
            <>
              <div style={{ fontSize: mapTiny ? 11 : mapCompact ? 12 : 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.35 }}>
                Which countries border the Arctic Ocean?
              </div>
              <div style={{ fontSize: mapTiny ? 9 : 11, color: '#aaa', marginBottom: mapTiny ? 8 : 12 }}>
                Click each country on the map
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: mapTiny ? 5 : 7 }}>
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
                      <span style={{ fontSize: mapTiny ? 10.5 : 12, fontWeight: found ? 600 : 400, flex: 1 }}>
                        {found ? name : '???'}
                      </span>
                      {found && (
                        <span style={{ fontSize: 11, color: '#4caf50' }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: mapTiny ? 9.5 : 11, color: '#666', marginTop: 10, textAlign: 'right' }}>
                {quizFound.size} / {QUIZ_COUNTRIES.length}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              
              <div style={{ fontSize: mapTiny ? 14 : 18, fontWeight: 700, marginBottom: 6 }}>All 6 found!</div>
              <div style={{ fontSize: mapTiny ? 12 : mapCompact ? 14 : 16, color: '#aaa', lineHeight: 1.5 }}>
                Russia, Canada, Norway, Greenland, Iceland and the United States all share a coastline
                with the Arctic Ocean.
              </div>
            </div>
          )}
        </div>
      )}

      {!isGlobe && !embed && !hideGlobeToggle && (
        <div style={{
          height:    mapTiny ? 32 : 40,
          width:     'fit-content',
          maxWidth:  `calc(100% - ${overlayInset * 2}px)`,
          position:  'absolute',
          bottom:    mapTiny ? 12 : mapCompact ? 16 : 24,
          left:      '50%',
          transform: 'translateX(-50%)',
          zIndex:    10,
        }}>
          <button
            onClick={requestGlobeView}
            style={{
              padding:        globeButtonPadding,
              borderRadius:   30,
              border:         '1px solid rgba(255,255,255,0.4)',
              background:     'rgba(0,0,0,0.55)',
              color:          '#fff',
              fontSize:       globeFontSize,
              fontWeight:     600,
              letterSpacing:  mapTiny ? 0 : '0.05em',
              cursor:         'pointer',
              backdropFilter: 'blur(6px)',
              animation:      !globeClicked ? 'dragPulse 1.4s ease-in-out infinite' : 'none',
              maxWidth:       '100%',
              whiteSpace:     'normal',
            }}
          >
            🌍 View the Arctic from above
          </button>
        </div>
      )}

      {showTemperatureLegend && (
        <div style={{
          position:             'absolute',
          top:                  overlayInset,
          right:                overlayInset,
          zIndex:               10,
          width:                legendWidth,
          padding:              overlayPadding,
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
            marginBottom:   mapTiny ? 5 : 7,
          }}>
            <span style={{ fontSize: overlayTitleFont, fontWeight: 700 }}>Temperature anomaly</span>
            <span style={{ fontSize: overlayTitleFont, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(cogYear ?? 1880)}
            </span>
          </div>
          <div style={{
            width:        '100%',
            height:       mapTiny ? 7 : 9,
            borderRadius: 999,
            background:   'linear-gradient(to right, #313695, #74add1, #f6f4e8, #fdae61, #a50026)',
            marginBottom: mapTiny ? 4 : 5,
          }} />
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            fontSize:       overlayTextFont,
            color:          '#435363',
          }}>
            <span>{cogVmin}°C</span>
            <span>0</span>
            <span>+{cogVmax}°C</span>
          </div>
        </div>
      )}

      {styleLoaded && <>

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
        

        {quizMode && ARCTIC_LABELS.filter(l => quizFound.has(l.iso)).map(({ name, longitude, latitude }) => (
          <Marker key={name} longitude={longitude} latitude={latitude} anchor="center">
            <div style={{
              color:         '#ffffff',
              fontSize:      countryLabelFont,
              fontWeight:    700,
              letterSpacing: mapTiny ? '0.06em' : '0.12em',
              whiteSpace:    'nowrap',
              pointerEvents: 'none',
              textShadow:    '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)',
            }}>
              {name}
            </div>
          </Marker>
        ))}

        <Source id="bathymetry" type="geojson" data={`${BASE}Final_depth_map.geojson`}>
          <Layer
            id="bathymetry-fill"
            type="fill"
            paint={{
              "fill-color": [
                "interpolate", ["linear"], ["get", "depth"],
                0,    "#d6eef7",
                200,  "#89c5e8",
                1000, "#5baed6",
                2000, "#2980b9",
                3000, "#1d5f9e",
                4000, "#1a3f7a",
                5000, "#0d2a5c",
              ],
              "fill-opacity": bathymetryFillOpacity,
              "fill-opacity-transition": { duration: 1500, delay: 0 },
            }}
          />
          <Layer
            id="bathymetry-shelf-highlight-fill"
            type="fill"
            filter={["any", ["==", ["get", "depth"], 0], ["==", ["get", "depth"], "0"]]}
            paint={{
              "fill-color": "#e8dfbd",
              "fill-opacity": shelfFillOpacity,
              "fill-opacity-transition": { duration: 1500, delay: 0 },
            }}
          />
          <Layer
            id="bathymetry-shelf-glow"
            type="line"
            filter={["any", ["==", ["get", "depth"], 0], ["==", ["get", "depth"], "0"]]}
            paint={{
              "line-color": "#d9cfaa",
              "line-width": shelfGlowWidth,
              "line-blur":  shelfGlowBlur,
              "line-opacity": shelfGlowOpacity,
              "line-opacity-transition": { duration: 1500, delay: 0 },
            }}
          />
          <Layer
            id="bathymetry-shelf-edge"
            type="line"
            filter={["any", ["==", ["get", "depth"], 0], ["==", ["get", "depth"], "0"]]}
            paint={{
              "line-color": "#5d777b",
              "line-width": shelfEdgeWidth,
              "line-opacity": shelfEdgeOpacity,
              "line-opacity-transition": { duration: 1500, delay: 0 },
            }}
          />
        </Source>

        <Source id="arctic-coastline" type="geojson" data={`${BASE}arctic-ocean-coastline.geojson`} lineMetrics={true}>
          <Layer
            id="arctic-coastline-glow"
            type="line"
            paint={{
              "line-color":   "#00bfff",
              "line-width":   coastlineGlowWidth,
              "line-opacity": 0,
              "line-blur":    0.60,
            }}
          />
          <Layer
            id="arctic-coastline-line"
            type="line"
            paint={{
              "line-color":   "#00bfff",
              "line-width":   coastlineLineWidth,
              "line-opacity": 0,
            }}
          />
        </Source>

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

        {cogLayer && <>
          <Source id="cog-a" type="image" url={cogLayer.dataUrl} coordinates={cogLayer.coordinates}>
            <Layer id="cog-raster-a" type="raster" paint={{ 'raster-opacity': slotAOpacity, 'raster-opacity-transition': { duration: cogFadeDuration, delay: 0 } }} />
          </Source>
          <Source id="cog-b" type="image" url={cogLayer.dataUrl} coordinates={cogLayer.coordinates}>
            <Layer id="cog-raster-b" type="raster" paint={{ 'raster-opacity': slotBOpacity, 'raster-opacity-transition': { duration: cogFadeDuration, delay: 0 } }} />
          </Source>
        </>}

      </>}

      {showBathymetryLegend && (
        <div style={{
          position:             'absolute',
          top:                  overlayInset,
          right:                overlayInset,
          zIndex:               10,
          width:                bathymetryLegendWidth,
          padding:              overlayPadding,
          borderRadius:         8,
          background:           'rgba(255,255,255,0.9)',
          backdropFilter:       'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow:            '0 2px 12px rgba(0,0,0,0.16)',
          color:                '#1d2b36',
          pointerEvents:        'none',
          opacity:              styleLoaded ? 1 : 0,
          transition:           'opacity 700ms ease',
        }}>
          <div style={{ fontSize: overlayTitleFont, fontWeight: 700, marginBottom: mapTiny ? 6 : 8 }}>
            Bathymetry depth
          </div>
          <div style={{
            width:        '100%',
            height:       mapTiny ? 8 : 10,
            borderRadius: 999,
            background:   'linear-gradient(to right, #d6eef7 0 14.285%, #89c5e8 14.285% 28.57%, #5baed6 28.57% 42.855%, #2980b9 42.855% 57.14%, #1d5f9e 57.14% 71.425%, #1a3f7a 71.425% 85.71%, #0d2a5c 85.71% 100%)',
            marginBottom: mapTiny ? 4 : 6,
          }} />
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            fontSize:       overlayTextFont,
            color:          '#435363',
          }}>
            <span>0 m</span>
            <span>2,500 m</span>
            <span>5,000 m</span>
          </div>
        </div>
      )}

      {completionOverlayImage && (
        <div style={{
          position:      'absolute',
          inset:         0,
          zIndex:        12,
          pointerEvents: 'none',
        }}>
          <img
            src={completionOverlayImage}
            alt=""
            style={{
              width:         '100%',
              height:        '100%',
              objectFit:     'cover',
              objectPosition:'center',
              display:       'block',
              opacity:       completionOverlayVisible ? 1 : 0,
              transition:    `opacity ${COMPLETION_OVERLAY_FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          />
        </div>
      )}

      <div style={{
        position:      'absolute',
        inset:         0,
        background:    useLightStyle ? 'white' : '#07111c',
        opacity:       styleLoaded ? 0 : 1,
        transition:    styleLoaded ? 'opacity 600ms ease' : 'opacity 150ms ease',
        pointerEvents: 'none',
        zIndex:        20,
      }} />

    </Map>
  );
});
