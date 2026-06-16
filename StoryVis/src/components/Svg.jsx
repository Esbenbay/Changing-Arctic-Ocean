import { useRef, useEffect } from 'react';
import { findAnchor, getLayerEl, zoomToLayer } from './svgHelpers.js';

const INTERACTIVE_LAYERS = {
  Sun_first:   { name: 'Sunlight & Seasons', description: 'The Arctic experiences extreme seasonal shifts in sunlight, with polar night in winter and midnight sun in summer. These cycles drive the rhythms of life and ecosystem productivity.', fadeOutWithLayer: 'Light_production', noHighlight: true, oneWay: false, fadeOutTransition: 'opacity 1000ms ease' },
  Sea_ice_early:     { name: 'Sea Ice',              description: 'Arctic sea ice extent has declined ~13% per decade since satellite records began. The loss of multi-year ice fundamentally restructures the ecosystem that depends on it.' },
  Clouds:      { name: 'Atmosphere & Clouds',  description: 'Reduced ice cover lowers the surface albedo — more solar energy is absorbed by the dark ocean, creating a self-reinforcing warming feedback loop.' },
  Light_production:         { name: 'Solar Radiation',      description: 'As ice retreats, unprecedented amounts of sunlight reach previously shaded Arctic waters, fuelling new biological productivity but also accelerating ocean warming.', noHighlight: true, fadeIn: true, fadeWithLayer: 'Light_production', pulseAnimation: 'lightPulse 3.5s ease-in-out infinite', oneWay: true },
  Phytoplankton: { name: 'Phytoplankton',      description: 'Phytoplankton blooms are expanding northward and occurring weeks earlier each season. These microscopic primary producers underpin the entire Arctic food web.' },
  Fish:        { name: 'Fish',                 description: 'Sub-Arctic species such as Atlantic cod and mackerel are moving north as waters warm, competing with endemic species and disrupting indigenous hunting practices.' },
  Sea_weed:    { name: 'Seaweed & Kelp',       description: 'Kelp forests are expanding into newly ice-free coastal zones, creating complex new habitats — but also competing with native seabed communities adapted to the cold.' },
  Corals:      { name: 'Cold-Water Corals',    description: 'Deep cold-water coral reefs are threatened by ocean acidification driven by rising CO₂ absorption. Their calcium carbonate skeletons dissolve as seawater pH drops.' },
  Waves:       { name: 'Waves',               description: 'Longer ice-free seasons mean longer fetch for wind-driven waves. Increased wave action accelerates coastal erosion and disrupts nearshore Arctic habitats.', activeAnimation: 'waveDrift 3.5s ease-in-out infinite', noHighlight: true },
  Low_erosion:          { name: 'Coastal Erosion',  description: 'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.', fadeOutWithLayer: 'River',  noHighlight: true, oneWay: true },
  Erosion_turbid:   { name: 'Turbid Erosion',  description: '', noHighlight: true, fadeIn: true, fadeWithLayer: 'River', pulseAnimation: 'turbidFlow 2.5s ease-in-out infinite',oneWay: true  },
  Erosion_off:      { name: 'Erosion Off',      description: '', fadeOutWithLayer: 'Waves', noHighlight: true, pulseAnimation: 'erosionslide 4s ease-in-out infinite' },
  SaltMarch:   { name: 'Salt Marsh',           description: 'Coastal wetlands act as blue carbon sinks, sequestering carbon at rates up to 10× higher than terrestrial forests. Their persistence is critical for climate mitigation.' },
  River:       { name: 'Rivers & Freshwater',  description: 'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.' },
  Mountain:    { name: 'Glaciers & Mountains', description: "Greenland's ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes." },
  Eddy:       { name: 'Eddy', description: "Eddies are swirling currents that can transport heat and nutrients throughout the Arctic Ocean, influencing local ecosystems and climate." },
  Benthic_highlight:       { name: 'Benthic Highlight', description: "Benthic highlights are areas of increased biological activity on the seafloor, often associated with underwater features like reefs or shipwrecks.",  },
  fade_in_benthic:       { name: 'Benthic Highlight_fade', description: "Benthic highlights are areas of increased biological activity on the seafloor, often associated with underwater features like reefs or shipwrecks.", fadeIn: true, noHighlight: true, fadeWithLayer: 'Benthic_highlight', fadeInTransition: 'opacity 1000ms ease 2000ms' },
  illustration_layers: { name: 'Illustration', description: "This illustration synthesizes the complex interactions and feedback loops in the Arctic ecosystem, highlighting key processes and vulnerabilities in a rapidly changing environment.", noHighlight: true },
  Instruments: { name: 'Instruments', description: "Instruments are essential for monitoring and understanding the changing Arctic environment. They provide critical data on temperature, ice thickness, and ecosystem health.", maxZoom: 10 },
  // 'Ship-1':         { name: 'Ship', description: '', maxZoom: 12, noHighlight: true },
  'kelp_highlight': { name: 'Kelp Highlight', description: '', maxZoom: 9, noHighlight: true, },
  Microphytobenthos:    { name: 'Microphytobenthos',   description: '', fadeIn: true, noHighlight: true, fadeWithLayer: 'kelp_highlight', fadeInTransition: 'opacity 1000ms ease 2000ms' },
  Sun_rays:         { name: 'Sun Rays',          description: '', fadeIn: true, noHighlight: true, fadeWithLayer: 'Light_production', pulseAnimation: 'lightPulse 2.8s ease-in-out infinite', oneWay: true },
  productive_ocean: { name: 'Productive Ocean', description: 'As sea ice retreats, sunlit open water expands the zone of primary productivity across the Arctic Ocean.', fadeIn: true, noHighlight: true, fadeWithLayer: 'Light_production', fadeOutTransition: 'opacity 2000ms ease 1000ms'  },
  Ships:            { name: 'Ships', description: '', maxZoom: 11, noHighlight: true },
};

const HIGHLIGHT_COLOR = '#00000073';

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

export default function SvgPanel({ src, activeLayerId, iceYear, onAnchorPosition }) {
  const containerRef   = useRef(null);
  const svgRef         = useRef(null);
  const activeLayerIdRef = useRef(activeLayerId);
  const iceShapesRef        = useRef([]);
  const fadeLayersRef       = useRef({});
  const highlightedLayerRef = useRef(null);
  const activeAnimLayerRef  = useRef(null);

  // Keep ref in sync so fetch callback can read latest value
  activeLayerIdRef.current = activeLayerId;

  // scroll-driven mode: activeLayerId prop is explicitly passed (even as null)
  const scrollDriven = activeLayerId !== undefined;

  // Helper: apply current scroll-driven highlight state to the loaded SVG
  const applyHighlight = (svg, label) => {
    // Only clear the one layer that actually has an outline — not all layers.
    if (highlightedLayerRef.current) {
      const prev = getLayerEl(svg, highlightedLayerRef.current);
      if (prev) setOutline(prev, null);
      highlightedLayerRef.current = null;
    }
    if (label && !INTERACTIVE_LAYERS[label]?.noHighlight) {
      const l = getLayerEl(svg, label);
      if (l) { setOutline(l, HIGHLIGHT_COLOR); highlightedLayerRef.current = label; }
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
        svg.style.backfaceVisibility = 'hidden';
        svg.style.webkitBackfaceVisibility = 'hidden';
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
          const fallbackCfg  = INTERACTIVE_LAYERS[activeLayerIdRef.current] ?? {};
          const zoomLabel    = fallbackCfg.zoomTarget ?? activeLayerIdRef.current;
          const fallbackLayer = getLayerEl(svg, zoomLabel);
          const anchorEl     = onAnchorPosition
            ? (fallbackLayer ? findAnchor(fallbackLayer) : null)
            : null;
          zoomToLayer(svg, containerRef.current, zoomLabel, { noTransition: true, anchorEl, onAnchorPosition });
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
    const layerEl   = getLayerEl(svg, zoomLabel);
    const anchorEl  = onAnchorPosition
      ? (layerEl ? findAnchor(layerEl) : null)
      : null;
    zoomToLayer(svg, containerRef.current, zoomLabel, {
      transition: cfg.zoomTransition,
      anchorEl,
      onAnchorPosition,
    });
    // Apply / remove activeAnimation on the current layer
    if (activeAnimLayerRef.current) {
      const prev = getLayerEl(svg, activeAnimLayerRef.current);
      if (prev) {
        prev.style.animation = 'none';
        prev.style.transformBox = '';
        prev.style.maskImage        = '';
        prev.style.webkitMaskImage  = '';
        prev.style.maskRepeat       = '';
        prev.style.webkitMaskRepeat = '';
        prev.style.maskSize         = '';
        prev.style.webkitMaskSize   = '';
      }
      activeAnimLayerRef.current = null;
    }
    const activeAnim = cfg.activeAnimation;
    if (activeAnim && layerEl) {
      layerEl.style.transformBox    = 'fill-box';
      layerEl.style.transformOrigin = 'center';
      if (cfg.activeMask) {
        layerEl.style.maskImage         = cfg.activeMask;
        layerEl.style.webkitMaskImage   = cfg.activeMask;
        layerEl.style.maskRepeat        = 'no-repeat';
        layerEl.style.webkitMaskRepeat  = 'no-repeat';
        layerEl.style.maskSize          = '100% 300%';
        layerEl.style.webkitMaskSize    = '100% 300%';
      }
      layerEl.style.animation       = activeAnim;
      activeAnimLayerRef.current    = zoomLabel;
    }
    // Fade layers in or out based on their trigger
    Object.entries(fadeLayersRef.current).forEach(([label, entry]) => {
      const { el, inverted } = entry;
      const cfg         = INTERACTIVE_LAYERS[label];
      const trigger     = cfg?.fadeWithLayer ?? cfg?.fadeOutWithLayer ?? label;
      const triggerActive = trigger === activeLayerId;
      const wasTriggered  = entry.triggered;
      if (triggerActive) entry.triggered = true;
      const isVisible = inverted ? !triggerActive : triggerActive;
      if (cfg?.pulseAnimation) {
        // Inverted layers (fadeOutWithLayer) start visible and pulse when triggered.
        // Normal layers (fadeIn) start hidden and pulse when triggered.
        const isPulseActive = inverted ? triggerActive : (isVisible || activeLayerId === label);
        if (isPulseActive) {
          el.style.transition = 'none';
          el.style.opacity    = '1';
          el.style.animation  = cfg.pulseAnimation;
        } else if (cfg?.oneWay && wasTriggered) {
          // stop pulsing but stay visible
          el.style.animation  = 'none';
          el.style.transition = 'none';
          el.style.opacity    = '1';
        } else {
          el.style.animation  = 'none';
          el.style.transition = cfg?.fadeOutTransition ?? 'opacity 1500ms ease';
          el.style.opacity    = inverted ? '1' : '0';
        }
      } else {
        if (cfg?.oneWay && wasTriggered) return; // already fired once — lock in place
        el.style.transition = isVisible
          ? (cfg?.fadeInTransition  ?? 'opacity 1500ms ease 600ms')
          : (cfg?.fadeOutTransition ?? 'opacity 1500ms ease');
        el.style.opacity = isVisible ? '1' : '0';
      }
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

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
