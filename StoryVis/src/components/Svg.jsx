import { useRef, useEffect } from 'react';
import gsap from 'gsap';

const INTERACTIVE_LAYERS = {
  Sea_ice_early:     { name: 'Sea Ice',              description: 'Arctic sea ice extent has declined ~13% per decade since satellite records began. The loss of multi-year ice fundamentally restructures the ecosystem that depends on it.' },
  Coulds:      { name: 'Atmosphere & Clouds',  description: 'Reduced ice cover lowers the surface albedo — more solar energy is absorbed by the dark ocean, creating a self-reinforcing warming feedback loop.' },
  Sun:         { name: 'Solar Radiation',      description: 'As ice retreats, unprecedented amounts of sunlight reach previously shaded Arctic waters, fuelling new biological productivity but also accelerating ocean warming.' },
  Phytoplankton: { name: 'Phytoplankton',      description: 'Phytoplankton blooms are expanding northward and occurring weeks earlier each season. These microscopic primary producers underpin the entire Arctic food web.' },
  Fish:        { name: 'Fish',                 description: 'Sub-Arctic species such as Atlantic cod and mackerel are moving north as waters warm, competing with endemic species and disrupting indigenous hunting practices.' },
  Sea_weed:    { name: 'Seaweed & Kelp',       description: 'Kelp forests are expanding into newly ice-free coastal zones, creating complex new habitats — but also competing with native seabed communities adapted to the cold.' },
  Corals:      { name: 'Cold-Water Corals',    description: 'Deep cold-water coral reefs are threatened by ocean acidification driven by rising CO₂ absorption. Their calcium carbonate skeletons dissolve as seawater pH drops.' },
  Waves:       { name: 'Waves',               description: 'Longer ice-free seasons mean longer fetch for wind-driven waves. Increased wave action accelerates coastal erosion and disrupts nearshore Arctic habitats.' },
  Erosion:          { name: 'Coastal Erosion',  description: 'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.', fadeOutWithLayer: 'River', zoomTarget: 'SaltMarch', noHighlight: true, oneWay: true },
  Erosion_turbid:   { name: 'Turbid Erosion',  description: '', fadeIn: true, noHighlight: true, fadeWithLayer: 'River', oneWay: true },
  Erosion_off:      { name: 'Erosion Off',      description: '', fadeOutWithLayer: 'Erosion', noHighlight: true, fadeOutTransition: 'opacity 2000ms ease 1000ms' },
  SaltMarch:   { name: 'Salt Marsh',           description: 'Coastal wetlands act as blue carbon sinks, sequestering carbon at rates up to 10× higher than terrestrial forests. Their persistence is critical for climate mitigation.' },
  River:       { name: 'Rivers & Freshwater',  description: 'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.' },
  Mountain:    { name: 'Glaciers & Mountains', description: "Greenland's ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes." },
  Eddy:       { name: 'Eddy', description: "Eddies are swirling currents that can transport heat and nutrients throughout the Arctic Ocean, influencing local ecosystems and climate." },
  Instruments: { name: 'Instruments', description: "Instruments are essential for monitoring and understanding the changing Arctic environment. They provide critical data on temperature, ice thickness, and ecosystem health.", maxZoom: 10 },
  'Ship-1':         { name: 'Ship', description: '', maxZoom: 12, noHighlight: true, useGsap: true },
  'kelp_highlight':     { name: 'Kelp Highlight',      description: '', maxZoom: 12, noHighlight: true, useGsap: true },
  Microphytobenthos:    { name: 'Microphytobenthos',   description: '', fadeIn: true, noHighlight: true, fadeWithLayer: 'kelp_highlight', fadeInTransition: 'opacity 1000ms ease 2000ms' },
  productive_ocean: { name: 'Productive Ocean', description: 'As sea ice retreats, sunlit open water expands the zone of primary productivity across the Arctic Ocean.', fadeIn: true, noHighlight: true, fadeWithLayer: 'Sun' },
};

const HIGHLIGHT_COLOR = '#fff70073';

// Add/remove an outline stroke on every shape in the layer.
// vector-effect: non-scaling-stroke keeps the width constant in screen pixels at any zoom.
const setOutline = (layer, color) => {
  layer.querySelectorAll('path, circle, rect, polygon, polyline').forEach(p => {
    if (color) {
      if (!p.dataset.origStroke)       p.dataset.origStroke       = p.style.stroke       || '__none__';
      if (!p.dataset.origStrokeWidth)  p.dataset.origStrokeWidth  = p.style.strokeWidth  || '__none__';
      if (!p.dataset.origVectorEffect) p.dataset.origVectorEffect = p.style.vectorEffect || '__none__';
      p.style.stroke       = color;
      p.style.strokeWidth  = '1px';
      p.style.vectorEffect = 'non-scaling-stroke';
    } else {
      const restore = (prop, key) => {
        if (!(key in p.dataset)) return; // never highlighted, leave original alone
        const orig = p.dataset[key];
        if (orig === '__none__') p.style.removeProperty(prop);
        else p.style.setProperty(prop, orig);
        delete p.dataset[key];
      };
      restore('stroke',        'origStroke');
      restore('stroke-width',  'origStrokeWidth');
      restore('vector-effect', 'origVectorEffect');
    }
  });
};

const ICE_START = 1979;
const ICE_END   = 2025;

// ── Shared helpers (also used by Photosynthesis.jsx) ─────────────────────────
export const getLayerEl = (svg, label) =>
  svg.querySelector(`[inkscape\\:label="${label}"]`) ??
  svg.querySelector(`#${label}`);

export function zoomToLayer(svg, containerEl, labelOrEl, { maxZoom: maxZoomOverride, noTransition = false, transition = '1500ms ease', useGsap = false, gsapDuration = 2.5 } = {}) {
  gsap.killTweensOf(svg, 'x,y,scale');

  if (!labelOrEl) {
    if (useGsap) {
      gsap.to(svg, { x: 0, y: 0, scale: 1, duration: gsapDuration, ease: 'power2.inOut', overwrite: true });
    } else {
      svg.style.transition = noTransition ? 'none' : `transform ${transition}`;
      svg.style.transformOrigin = '0 0';
      svg.style.transform = 'none';
    }
    return;
  }

  svg.style.transformOrigin = '0 0';

  // Accept either a label string or a pre-resolved element
  const layerEl = typeof labelOrEl === 'string' ? getLayerEl(svg, labelOrEl) : labelOrEl;
  if (!layerEl) return;

  const cW = containerEl.clientWidth;
  const cH = containerEl.clientHeight;
  const vb = svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;

  const s     = Math.min(cW / vb.width, cH / vb.height);
  const offX  = (cW - vb.width  * s) / 2;
  const offY  = (cH - vb.height * s) / 2;
  const svgPixW = vb.width  * s;
  const svgPixH = vb.height * s;

  const bbox = layerEl.getBBox();
  if (!bbox.width || !bbox.height) return;

  const svgCTM   = svg.getScreenCTM();
  const layerCTM = layerEl.getScreenCTM();
  if (svgCTM && layerCTM) {
    const toViewBox = svgCTM.inverse().multiply(layerCTM);
    const corners   = [
      { x: bbox.x,              y: bbox.y               },
      { x: bbox.x + bbox.width, y: bbox.y               },
      { x: bbox.x,              y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ].map(({ x, y }) => {
      const pt = svg.createSVGPoint();
      pt.x = x; pt.y = y;
      return pt.matrixTransform(toViewBox);
    });
    bbox.x      = Math.min(...corners.map(p => p.x));
    bbox.y      = Math.min(...corners.map(p => p.y));
    bbox.width  = Math.max(...corners.map(p => p.x)) - bbox.x;
    bbox.height = Math.max(...corners.map(p => p.y)) - bbox.y;
  }

  const pixCX = (bbox.x + bbox.width  / 2) * s + offX;
  const pixCY = (bbox.y + bbox.height / 2) * s + offY;
  const pixW  = bbox.width  * s;
  const pixH  = bbox.height * s;

  const fillZoom = Math.max(cW / svgPixW, cH / svgPixH);
  const labelKey = typeof labelOrEl === 'string' ? labelOrEl : null;
  const maxZoom  = maxZoomOverride ?? INTERACTIVE_LAYERS[labelKey]?.maxZoom ?? 3.5;
  const zoom     = Math.max(fillZoom, Math.min(cW / (pixW * 1.4), cH / (pixH * 1.4), maxZoom));

  let tx = cW / 2 / zoom - pixCX;
  let ty = cH / 2 / zoom - pixCY;
  tx = Math.min(tx, -offX);
  tx = Math.max(tx, -(offX + svgPixW) + cW / zoom);
  ty = Math.min(ty, -offY);
  ty = Math.max(ty, -(offY + svgPixH) + cH / zoom);

  if (useGsap) {
    const method = noTransition ? gsap.set : gsap.to;
    method(svg, { x: tx * zoom, y: ty * zoom, scale: zoom, transformOrigin: '0 0',
      duration: noTransition ? 0 : gsapDuration, ease: 'power2.inOut', overwrite: true });
  } else {
    svg.style.transition      = noTransition ? 'none' : `transform ${transition}`;
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `scale(${zoom}) translate(${tx}px, ${ty}px)`;
  }
}

export default function SvgPanel({ src, activeLayerId, iceYear }) {
  const containerRef   = useRef(null);
  const svgRef         = useRef(null);
  const activeLayerIdRef = useRef(activeLayerId);
  const iceShapesRef   = useRef([]);
  const fadeLayersRef  = useRef({});

  // Keep ref in sync so fetch callback can read latest value
  activeLayerIdRef.current = activeLayerId;

  // scroll-driven mode: activeLayerId prop is explicitly passed (even as null)
  const scrollDriven = activeLayerId !== undefined;

  // Helper: apply current scroll-driven highlight state to the loaded SVG
  const applyHighlight = (svg, label) => {
    Object.keys(INTERACTIVE_LAYERS).forEach(key => {
      const l = getLayerEl(svg, key);
      if (l) setOutline(l, null);
    });
    if (label && !INTERACTIVE_LAYERS[label]?.noHighlight) {
      const l = getLayerEl(svg, label);
      if (l) setOutline(l, HIGHLIGHT_COLOR);
    }
  };


  // Load and wire up SVG
  useEffect(() => {
    if (!containerRef.current) return;

    fetch(src)
      .then(r => r.text())
      .then(svgText => {
        containerRef.current.innerHTML = svgText;
        const svg = containerRef.current.querySelector('svg');
        if (!svg) return;
        svg.style.width = '100%';
        svg.style.height = '100%';
        svgRef.current = svg;

        // Register fade-controlled layers
        Object.entries(INTERACTIVE_LAYERS).forEach(([label, cfg]) => {
          if (!cfg.fadeIn && !cfg.fadeOutWithLayer) return;
            const el = getLayerEl(svg, label);
            if (!el) return;
            const inverted = !!cfg.fadeOutWithLayer && !cfg.fadeIn;
            el.style.opacity    = inverted ? '1' : '0';
            el.style.transition = 'opacity 1500ms ease';
            fadeLayersRef.current[label] = { el, inverted, triggered: false };
          });

        // Assign each shape in Sea_ice_early a random fade threshold year
        const earlyLayer = getLayerEl(svg, 'Sea_ice_early');
        if (earlyLayer) {
          iceShapesRef.current = [...earlyLayer.children]
            .map(el => {
              el.style.transition = 'opacity 400ms ease';
              return { el, fadeYear: ICE_START + Math.random() * (ICE_END - ICE_START) };
            });
        }

        // Apply whatever highlight + zoom is already active (handles late SVG load)
        if (activeLayerIdRef.current !== undefined) {
          applyHighlight(svg, activeLayerIdRef.current);
          const fallbackCfg = INTERACTIVE_LAYERS[activeLayerIdRef.current] ?? {};
          zoomToLayer(svg, containerRef.current, fallbackCfg.zoomTarget ?? activeLayerIdRef.current, { useGsap: fallbackCfg.useGsap });
        }


      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Apply scroll-driven highlight + zoom when activeLayerId changes
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !scrollDriven) return;
    applyHighlight(svg, activeLayerId);
    const cfg       = INTERACTIVE_LAYERS[activeLayerId] ?? {};
    const zoomLabel = cfg.zoomTarget ?? activeLayerId;
    zoomToLayer(svg, containerRef.current, zoomLabel, { transition: cfg.zoomTransition, useGsap: cfg.useGsap });
    // Fade layers in or out based on their trigger
    Object.entries(fadeLayersRef.current).forEach(([label, entry]) => {
      const { el, inverted } = entry;
      const cfg         = INTERACTIVE_LAYERS[label];
      const trigger     = cfg?.fadeWithLayer ?? cfg?.fadeOutWithLayer ?? label;
      const triggerActive = trigger === activeLayerId;
      if (cfg?.oneWay && entry.triggered) return; // permanent — never reverse
      if (triggerActive) entry.triggered = true;
      const isVisible = inverted ? !triggerActive : triggerActive;
      el.style.transition = isVisible
        ? (cfg?.fadeInTransition  ?? 'opacity 1500ms ease 600ms')
        : (cfg?.fadeOutTransition ?? 'opacity 1500ms ease');
      el.style.opacity = isVisible ? '1' : '0';
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId]);

  // Fade individual Sea_ice_early shapes as the year slider moves.
  // Each shape has a random threshold — once the slider passes it, that piece fades out.
  useEffect(() => {
    if (iceYear == null) return;
    iceShapesRef.current.forEach(({ el, fadeYear }) => {
      el.style.opacity = iceYear >= fadeYear ? '0' : '1';
    });
  }, [iceYear]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
