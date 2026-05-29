import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { zoomToLayer, findAnchor } from './Svg.jsx';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

const BASE = import.meta.env.BASE_URL;

gsap.registerPlugin(MotionPathPlugin);

// Layers visible at each step — cumulative: once shown, stays shown
const PHOTO_LAYERS = {
   g84:          { show: ['g84'] },
  Sea_weed:          { show: ['Sea_weed'] },
  O2_micro:          { show: ['O2_micro'] },
  Sun:               { show: ['Eddy'], zoomTarget: 'g84' },
  Light_ray:         { show: ['Light_ray'] },
  Carbon_non_turbid: { show: ['Light_ray', 'Carbon_non_turbid'] },
  O2:                { show: ['Light_ray', 'Carbon_non_turbid', 'O2'] },
  Eddy:              { show: ['Eddy'] },
  Ship_1:            { show: ['Light_ray', 'Carbon_non_turbid', 'O2', 'Ship_1', 'Ship_2'] },
  Oil:               { show: ['Light_ray', 'Carbon_non_turbid', 'O2', 'Ship_1', 'Ship_2', 'Oil'] },
};

const ALL_FADE_LAYERS = ['Carbon_non_turbid','Light_ray','O2', 'Eddy', 'Ship_1', 'Ship_2', 'Oil'];

// Trigger-based fade layers — fire when `trigger` step becomes active.
//   trigger:         layerId string that activates this layer
//   oneWay:          true → stays visible permanently once triggered
//   fadeInDuration:  seconds for fade-in  (default 1.5)
//   fadeOutDuration: seconds for fade-out (default 1.5)
const PHOTO_FADE_LAYERS = {
  Carbon_non_turbid: { trigger: 'Sea_weed', oneWay: true },
  Light_ray:         { trigger: 'Sea_weed', oneWay: true },
  O2_micro:          { trigger: 'Sea_weed', fadeInDuration: 2.0 },
};

// Layers whose direct children randomly blink in/out while the layer is visible.
const RANDOM_FADE_LAYERS = [
  'Carbon_non_turbid',
];

// ── Motion-path animations ─────────────────────────────────────────────────────
// Add entries here to wire up new motion-path loops.
//   elementLabel: inkscape:label (or id) of the element to move
//   pathLabel:    inkscape:label (or id) of the <path> (or group containing one)
//   triggerStep:  activeLayerId value that starts the animation
//   duration:     seconds per loop
//   repeat:       GSAP repeat count (-1 = infinite)
const MOTION_PATH_ANIMS = {
  O2_micro: { elementLabel: 'O2_micro',  pathLabel: 'Micro_path_', triggerStep: 'Sea_weed', duration: 6, repeat: -1 },
  Eddy:     { elementLabel: 'Eddy',      pathLabel: 'Eddy_path',   triggerStep: 'Sun',      duration: 3, repeat: 0 },
};

export default function PhotosynthesisPanel({ activeLayerId, active, erosionProgress, onAnchorPosition }) {
  const containerRef      = useRef(null);
  const svgRef            = useRef(null);
  const iceTweenRef       = useRef(null);
  const hasInitialZoomRef = useRef(false);
  const zoomTimerRef      = useRef(null);
  const fadeLayersRef     = useRef({});   // PHOTO_FADE_LAYERS runtime state
  const randomFadeRef     = useRef({});   // active setInterval IDs keyed by layer name
  const motionTweensRef   = useRef({});   // keyed by MOTION_PATH_ANIMS key
  const quickSettersRef   = useRef({});   // gsap.quickSetter functions for erosion slider

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    fetch(`${BASE}Phytosynthesis_Arctic_summer.svg`)
      .then(r => r.text())
      .then(svgText => {
        if (!containerRef.current) return;
        container.innerHTML = svgText;

        const svg = container.querySelector('svg');
        if (!svg) return;
        svg.style.width                    = '100%';
        svg.style.height                   = '100%';
        svg.style.transformOrigin          = '0 0';
        svg.style.backfaceVisibility       = 'hidden';
        svg.style.webkitBackfaceVisibility = 'hidden';
        svgRef.current = svg;

        // Prefix all IDs to avoid clashing with Late_summer.svg in DOM
        const P = 'ph__';
        svg.querySelectorAll('[id]').forEach(el => { el.id = P + el.id; });
        svg.querySelectorAll('*').forEach(el => {
          ['fill', 'stroke', 'filter', 'clip-path', 'mask'].forEach(attr => {
            const v = el.getAttribute(attr);
            if (v) el.setAttribute(attr, v.replace(/url\(#([^)]+)\)/g, `url(#${P}$1)`));
          });
          const s = el.getAttribute('style');
          if (s) el.setAttribute('style', s.replace(/url\(#([^)]+)\)/g, `url(#${P}$1)`));
          const xl = el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          if (xl?.startsWith('#')) el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + P + xl.slice(1));
          const href = el.getAttribute('href');
          if (href?.startsWith('#')) el.setAttribute('href', '#' + P + href.slice(1));
        });
        const styleEl = svg.querySelector('style');
        if (styleEl) styleEl.textContent = styleEl.textContent.replace(/#([\w-]+)/g, `#${P}$1`);

        const getEl = label =>
          svg.querySelector(`[inkscape\\:label="${label}"]`) ??
          svg.querySelector(`#${P}${label}`);

        // Hide all show-driven layers — GSAP owns opacity from the start
        ALL_FADE_LAYERS.forEach(name => {
          const el = getEl(name);
          if (el) gsap.set(el, { opacity: 0 });
        });

        // Register trigger-based fade layers — GSAP owns opacity from the start
        fadeLayersRef.current = {};
        Object.entries(PHOTO_FADE_LAYERS).forEach(([name, cfg]) => {
          const el = getEl(name);
          if (!el) return;
          gsap.set(el, { opacity: 0 });
          fadeLayersRef.current[name] = { el, triggered: false, cfg };
        });

        const erosionEl  = getEl('Erosion_layer');
        const iceNotMove = getEl('Ice_not_move');
        const iceEl      = getEl('Ice_layer');
        if (erosionEl) gsap.set(erosionEl, { opacity: 0 });

        // quickSetters for rapid erosion-slider updates (no tween overhead per tick)
        quickSettersRef.current = {
          iceOpacity:     iceEl      ? gsap.quickSetter(iceEl,      'opacity') : null,
          iceNotOpacity:  iceNotMove ? gsap.quickSetter(iceNotMove, 'opacity') : null,
          erosionOpacity: erosionEl  ? gsap.quickSetter(erosionEl,  'opacity') : null,
        };

        // Ice moves along Ice_path when the erosion slider is dragged
        const icePathEl = getEl('Ice_path');
        const icePath   = icePathEl?.tagName?.toLowerCase() === 'path'
          ? icePathEl : icePathEl?.querySelector('path');
        if (iceEl && icePath) {
          const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          iceEl.parentNode.insertBefore(w, iceEl);
          w.appendChild(iceEl);
          iceTweenRef.current = gsap.to(w, {
            motionPath: { path: icePath, align: icePath, alignOrigin: [0.5, 0.5], autoRotate: false },
            duration: 1, ease: 'none', paused: true, immediateRender: true,
          });
        }

        // Motion-path animations — driven by MOTION_PATH_ANIMS config
        motionTweensRef.current = {};
        Object.entries(MOTION_PATH_ANIMS).forEach(([key, animCfg]) => {
          const el     = getEl(animCfg.elementLabel);
          const pathEl = getEl(animCfg.pathLabel);
          const path   = pathEl?.tagName?.toLowerCase() === 'path' ? pathEl : pathEl?.querySelector('path');
          if (!el || !path) return;
          const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          el.parentNode.insertBefore(w, el);
          w.appendChild(el);
          motionTweensRef.current[key] = gsap.to(w, {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
            duration: animCfg.duration, ease: 'none', repeat: animCfg.repeat, paused: true, immediateRender: true,
          });
        });
      });

    return () => {
      iceTweenRef.current?.kill();
      Object.values(motionTweensRef.current).forEach(t => t.kill());
      Object.values(randomFadeRef.current).forEach(clearInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset zoom flag and stop micro animation when leaving the chapter
  useEffect(() => {
    if (!active) {
      hasInitialZoomRef.current = false;
      Object.values(motionTweensRef.current).forEach(t => t.pause());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Show/hide layers, zoom, and trigger fade/random effects based on active layer
  useEffect(() => {
    clearTimeout(zoomTimerRef.current);

    const svg       = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const getEl = label =>
      svg.querySelector(`[inkscape\\:label="${label}"]`) ??
      svg.querySelector(`#ph__${label}`);

    const cfg = activeLayerId != null ? PHOTO_LAYERS[activeLayerId] : null;

    // ── Zoom ──────────────────────────────────────────────────────────────────
    if (cfg) {
      const zoomEl   = 'zoomTarget' in cfg
        ? (cfg.zoomTarget ? getEl(cfg.zoomTarget) : null)
        : getEl(activeLayerId);
      const anchorEl = zoomEl ? findAnchor(zoomEl) : null;
      zoomToLayer(svg, container, zoomEl, {
        transition:       '1800ms cubic-bezier(0.16, 1, 0.3, 1)',
        maxZoom:          5,
        anchorEl,
        onAnchorPosition,
      });
    } else if (activeLayerId === null) {
      onAnchorPosition?.(null);
      const seaWeedEl = getEl('Sea_weed');
      if (seaWeedEl) {
        if (!hasInitialZoomRef.current) {
          zoomToLayer(svg, container, seaWeedEl, { noTransition: true, maxZoom: 10 });
          hasInitialZoomRef.current = true;
        } else {
          zoomToLayer(svg, container, seaWeedEl, {
            transition: '1400ms cubic-bezier(0.4, 0, 0.2, 1)',
            maxZoom:    10,
          });
        }
      }
    }

    // ── Show-driven fades (ALL_FADE_LAYERS) ───────────────────────────────────
    const visible = new Set(cfg?.show ?? []);
    ALL_FADE_LAYERS.forEach(name => {
      const el = getEl(name);
      if (el) gsap.to(el, { opacity: visible.has(name) ? 1 : 0, duration: 1.0, ease: 'power2.inOut', overwrite: 'auto' });
    });

    // ── Trigger-based fade layers (PHOTO_FADE_LAYERS) ─────────────────────────
    Object.entries(fadeLayersRef.current).forEach(([, entry]) => {
      const { el, cfg: fadeCfg } = entry;
      const isActive    = fadeCfg.trigger === activeLayerId;
      if (isActive) entry.triggered = true;
      const stayVisible = fadeCfg.oneWay && entry.triggered;

      if (isActive) {
        gsap.to(el, { opacity: 1, duration: fadeCfg.fadeInDuration ?? 1.5, ease: 'power2.inOut', overwrite: 'auto' });
      } else if (!stayVisible) {
        gsap.to(el, { opacity: 0, duration: fadeCfg.fadeOutDuration ?? 1.5, ease: 'power2.inOut', overwrite: 'auto' });
      }
      // stayVisible && !isActive: already at 1, GSAP leaves it alone
    });

    // ── Build combined visible set for random fades ───────────────────────────
    const allVisible = new Set(visible);
    Object.entries(fadeLayersRef.current).forEach(([name, entry]) => {
      const isActive = entry.cfg.trigger === activeLayerId;
      const stayVis  = entry.cfg.oneWay && entry.triggered;
      if (isActive || stayVis) allVisible.add(name);
    });

    // ── Play/pause motion-path loops ──────────────────────────────────────────
    // Infinite loops resume from pause; one-shot anims restart from the beginning.
    Object.entries(MOTION_PATH_ANIMS).forEach(([key, animCfg]) => {
      const tween = motionTweensRef.current[key];
      if (!tween) return;
      if (animCfg.triggerStep === activeLayerId) {
        if (animCfg.repeat >= 0) tween.restart();
        else tween.play();
      } else {
        tween.pause();
      }
    });

    // ── Random sub-layer blinking — only start/stop on visibility change ──────
    RANDOM_FADE_LAYERS.forEach(name => {
      const running   = name in randomFadeRef.current;
      const shouldRun = allVisible.has(name);
      if (running && !shouldRun) {
        clearInterval(randomFadeRef.current[name]);
        delete randomFadeRef.current[name];
      } else if (!running && shouldRun) {
        const el = getEl(name);
        if (!el) return;
        const children = [...el.querySelectorAll('path, circle, ellipse, rect, polygon')];
        if (!children.length) return;
        randomFadeRef.current[name] = setInterval(() => {
          const count = Math.ceil(children.length * 0.2);
          [...children]
            .sort(() => Math.random() - 0.5)
            .slice(0, count)
            .forEach(c => gsap.to(c, { opacity: Math.random() > 0.5 ? 1 : 0.5, duration: 1.2, ease: 'power1.inOut', overwrite: 'auto' }));
        }, 2000);
      }
    });
  }, [activeLayerId]);

  // Erosion slider: cross-fade ice out / erosion in, move ice along path
  useEffect(() => {
    if (erosionProgress == null) return;
    const { iceOpacity, iceNotOpacity, erosionOpacity } = quickSettersRef.current;
    iceOpacity?.(1 - erosionProgress);
    iceNotOpacity?.(1 - erosionProgress);
    erosionOpacity?.(erosionProgress);
    if (iceTweenRef.current) gsap.to(iceTweenRef.current, { progress: erosionProgress, duration: 0.1, ease: 'none', overwrite: true });
  }, [erosionProgress]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
