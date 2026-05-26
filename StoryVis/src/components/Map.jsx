import { Map, Layer, Source, Marker } from "react-map-gl/mapbox";
import { useEffect, useRef, useState, useCallback } from "react";
import { track } from "../tracker.js";

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const BASE  = import.meta.env.BASE_URL;

const alterSpeed = 0.8;
const alterPitch = 2;

// ── Named camera positions ────────────────────────────────────────────────────
// Keys are referenced from the `camera` field in Story.jsx's STEPS array.

const CAMERAS = {
  // Map chapter
  'arctic-quiz':    { center: [0, 85], zoom: 3,    speed: alterSpeed, pitch: 0, bearing: 0      },
  'world-overview': { center: [1,           0        ], zoom: 0.5,  speed: alterSpeed, pitch: alterPitch },
  'svalbard':       { center: [15.678037,   77.746261], zoom: 14.5, speed: alterSpeed, pitch: alterPitch },
  'canada-arctic':  { center: [-99.214076,  73.476835], zoom: 3.7,  speed: alterSpeed, pitch: alterPitch },

  //'arctic-coastline':  { center: [120.734026, 85.53], zoom: 2.6,    speed: alterSpeed, pitch: 25, duration: 10000},
  'arctic-coastline':  { center: [0, 85], zoom: 2.7,    speed: alterSpeed, pitch: 0     },
  'greenland-overview':  { center: [-42, 72],              zoom: 3, speed: alterSpeed, pitch: alterPitch },
  'greenland-glaciers':  { center: [-41.338798, 64.249670], zoom: 9, speed: alterSpeed, pitch: alterPitch },

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

// Dashed line marking the Arctic Circle at 66.5622°N
const ARCTIC_CIRCLE_GEOJSON = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: Array.from({ length: 361 }, (_, i) => [-180 + i, 66.5622]),
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

export default function NewMap({ cameraKey, quizMode, embed = false }) {
  const mapRef            = useRef(null);
  const resizeObserverRef = useRef(null);
  const coastlineAnimRef  = useRef(null);
  const rotateRef         = useRef(null);

  const [firstLandLayerId, setFirstLandLayerId] = useState(undefined);
  const [isGlobe, setIsGlobe]                   = useState(false);
  const [styleLoaded, setStyleLoaded]           = useState(false);
  const [globeClicked, setGlobeClicked]         = useState(false);

  // Quiz: which ISO codes the user has clicked so far
  const [quizFound, setQuizFound] = useState(new Set());
  // Ref lets the click-handler closure always read the latest set without re-binding
  const quizFoundRef = useRef(new Set());

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
      setIsGlobe(true);
      map.jumpTo({ center: [20, 78], zoom: 1.5, pitch: 20, bearing: 0 });
      const rotate = () => {
        map.setBearing((map.getBearing() + 0.06) % 360);
        rotateRef.current = requestAnimationFrame(rotate);
      };
      rotateRef.current = requestAnimationFrame(rotate);
    } else if (cameraKey === 'greenland-glaciers' && embed) {
      map.setProjection('globe');
      setIsGlobe(true);
      map.flyTo({ center: [-41, 74], zoom: 3, pitch: 0, bearing: 0, duration: 1200 });
      onMoveEnd = () => map.flyTo(CAMERAS['greenland-glaciers']);
      map.once('moveend', onMoveEnd);
    } else if (CAMERAS[cameraKey]) {
      map.flyTo(CAMERAS[cameraKey]);
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
    };
  }, [cameraKey, styleLoaded]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => resizeObserverRef.current?.disconnect();
  }, []);

  // ── Map load ───────────────────────────────────────────────────────────────
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    map.setConfigProperty('basemap', 'showPlaceLabels',          false);
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
    map.setConfigProperty('basemap', 'showTransitLabels',         false);
    map.setConfigProperty('basemap', 'showRoadLabels',            false);

    const landLayer = map.getStyle().layers.find(l =>
      l.type === 'fill' &&
      (l.id.includes('land') || l.id.includes('terrain') || l.id.includes('background'))
    );
    if (landLayer) setFirstLandLayerId(landLayer.id);

    const observer = new ResizeObserver(() => mapRef.current?.getMap().resize());
    observer.observe(map.getContainer());
    resizeObserverRef.current = observer;

    map.on('error', ({ error }) => {
      if (error?.status === 404) return;
      console.error(error);
    });

    setStyleLoaded(true);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={{ latitude: 0, longitude: 1.558794, zoom: 0 }}
      projection="mercator"
      mapStyle="mapbox://styles/mapbox/standard-satellite"
      style={{ width: "100%", height: "100%" }}
      onLoad={handleMapLoad}
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
      {!isGlobe && !embed && (
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

      {styleLoaded && <>

        {/* Blue tint over the Arctic Ocean (60°N and above) */}
        {/* <Source id="arctic-ocean" type="geojson" data={ARCTIC_OCEAN_GEOJSON}>
          <Layer
            id="arctic-ocean-fill"
            type="fill"
            beforeId={firstLandLayerId}
            paint={{
              "fill-color":   "#636af4",
              "fill-opacity": 0.4,
            }}
          />
        </Source> */}

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

        {/* Arctic coastline — drawn on via line-gradient animation when camera enters */}
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

        {/* Dashed line marking the Arctic Circle at 66.5°N */}
        <Source id="arctic-circle" type="geojson" data={ARCTIC_CIRCLE_GEOJSON}>
          <Layer
            id="arctic-circle-glow"
            type="line"
            paint={{
              "line-color":   "#0188f5",
              "line-width":   8,
              "line-opacity": 0.2,
              "line-blur":    4,
            }}
          />
          <Layer
            id="arctic-circle-line"
            type="line"
            paint={{
              "line-color":     "#90caf9",
              "line-width":     1.5,
              "line-opacity":   0.85,
              "line-dasharray": [6, 4],
            }}
          />
        </Source>

      </>}

    </Map>
  );
}
