import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { zoomToLayer } from './Svg.jsx';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

const BASE = import.meta.env.BASE_URL;

gsap.registerPlugin(MotionPathPlugin);

const TOTAL_STEPS   = 10;
const O2_START      = 3; // O2 begins moving at step 2
// Sun progress per step — step 3 intentionally repeats step 2 (pause)
const SUN_PROGRESS  = [0, 0,  0.25, 0.5, 0.5, 0.75, 1.0];

export default function PhotosynthesisPanel({ stepIndex, active }) {
  const containerRef     = useRef(null);
  const svgRef           = useRef(null);
  const tweenRef         = useRef(null);
  const hasInitialZoomRef = useRef(false);
  const iceShapesRef    = useRef([]);
  const carbonShapesRef = useRef([]);
  const oilShapesRef    = useRef([]); // [{el, threshold}] — each oil piece fades in randomly at step 8
  const fadeEls         = useRef({});

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
        svg.style.width  = '100%';
        svg.style.height = '100%';
        svg.style.transformOrigin = '0 0';
        svgRef.current = svg;

        // Prefix all IDs so this SVG's gradients/filters never clash with
        // Late_summer.svg which is in the DOM at the same time during transitions
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

        // Look up by inkscape:label first, fall back to prefixed id
        const getEl = label =>
          svg.querySelector(`[inkscape\\:label="${label}"]`) ??
          svg.querySelector(`#${P}${label}`);

        const sunEl   = getEl('Sun');
        const arcEl   = getEl('Sun_path');
        const arcPath = arcEl?.tagName?.toLowerCase() === 'path' ? arcEl : arcEl?.querySelector('path');

        if (!sunEl || !arcPath) return;

        // Wrap #Sun so GSAP's CSS transform doesn't disturb its own SVG
        // transform or the userSpaceOnUse gradients inside it
        // Helper: wrap an element so GSAP's CSS transform doesn't disturb
        // the element's own SVG transform or userSpaceOnUse gradients
        const makeWrapper = el => {
          const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          el.parentNode.insertBefore(w, el);
          w.appendChild(el);
          return w;
        };

        // Helper: paused tween along a path — progress driven by scroll
        const makeTween = (el, path) => {
          const w = makeWrapper(el);
          return gsap.to(w, {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
            duration: 1,
            ease:     'none',
            paused:   true,
          });
        };

        const o2El    = getEl('O2');
        const o2ArcEl = getEl('O2_path');
        const o2Path  = o2ArcEl?.tagName?.toLowerCase() === 'path' ? o2ArcEl : o2ArcEl?.querySelector('path');

        const eddyEl    = getEl('Eddy');
        const eddyArcEl = getEl('Eddy_path');
        const eddyPath  = eddyArcEl?.tagName?.toLowerCase() === 'path' ? eddyArcEl : eddyArcEl?.querySelector('path');

        const ship1El     = getEl('Ship_1');
        const ship2El     = getEl('Ship_2');
        const ship1ArcEl  = getEl('Ship_1_path');
        const ship2ArcEl  = getEl('Ship_2_path');
        const ship1Path   = ship1ArcEl?.tagName?.toLowerCase() === 'path' ? ship1ArcEl : ship1ArcEl?.querySelector('path');
        const ship2Path   = ship2ArcEl?.tagName?.toLowerCase() === 'path' ? ship2ArcEl : ship2ArcEl?.querySelector('path');

        const lightRayEl = getEl('Light_ray');
        const carbonEl   = getEl('Carbon_non_turbid');

        const iceEl   = getEl('Ice_layer');
        const icePath = getEl('Ice_path');

        // Assign each direct child of Ice_layer a random fade threshold (0–1).
        // As scroll progress increases, pieces whose threshold is passed fade out.
        if (iceEl) {
          iceShapesRef.current = [...iceEl.children].map(el => ({
            el,
            threshold: Math.random() * SUN_PROGRESS[3], // ~50% fade at step 2, rest at step 3
          }));
        }

        tweenRef.current = {
          sun:   makeTween(sunEl, arcPath),
          ice:   iceEl   && icePath   ? makeTween(iceEl,   icePath)   : null,
          o2:    o2El    && o2Path    ? makeTween(o2El,    o2Path)    : null,
          eddy:  eddyEl  && eddyPath  ? makeTween(eddyEl,  eddyPath)  : null,
          ship1: ship1El && ship1Path ? makeTween(ship1El, ship1Path) : null,
          ship2: ship2El && ship2Path ? makeTween(ship2El, ship2Path) : null,
        };

        // Carbon children fade in randomly from step 1 (sunP 0.25) to step 2 (sunP 0.5)
        if (carbonEl) {
          carbonShapesRef.current = [...carbonEl.children].map(el => ({
            el,
            threshold: Math.random() * SUN_PROGRESS[2],
          }));
          gsap.set(carbonEl.children, { opacity: 0 });
        }

        const oilEl = getEl('Oil');
        if (oilEl) {
          oilShapesRef.current = [...oilEl.children].map(el => ({
            el,
            threshold: Math.random(),
          }));
          gsap.set(oilEl.children, { opacity: 0 });
        }

        fadeEls.current = { lightRay: lightRayEl, o2: o2El, eddy: eddyEl, ship1: ship1El, ship2: ship2El };
        gsap.set([lightRayEl, o2El, eddyEl, ship1El, ship2El].filter(Boolean), { opacity: 0 });

        const sunP    = SUN_PROGRESS[Math.min(stepIndex, SUN_PROGRESS.length - 1)];
        const o2P     = Math.max(0, (stepIndex - O2_START) / (TOTAL_STEPS - O2_START));
        const iceGone = SUN_PROGRESS[2];
        const eddyP = Math.min(Math.max(0, stepIndex - 1), 1);
        tweenRef.current.sun.progress(sunP);
        tweenRef.current.ice?.progress(sunP);
        tweenRef.current.o2?.progress(o2P);
        tweenRef.current.eddy?.progress(eddyP);

        // Apply initial fade states
        iceShapesRef.current.forEach(({ el, threshold }) => {
          gsap.set(el, { opacity: sunP >= threshold ? 0 : 1 });
        });
        if (lightRayEl) gsap.set(lightRayEl, { opacity: Math.min(sunP / iceGone, 1) });
        if (o2El)       gsap.set(o2El,       { opacity: Math.max(0, (sunP - SUN_PROGRESS[3]) / (SUN_PROGRESS[4] - SUN_PROGRESS[3])) });
        carbonShapesRef.current.forEach(({ el, threshold }) => {
          gsap.set(el, { opacity: sunP >= threshold ? 1 : 0 });
        });

      });

    return () => {
      tweenRef.current?.sun?.kill();
      tweenRef.current?.ice?.kill();
      tweenRef.current?.o2?.kill();
      tweenRef.current?.eddy?.kill();
      tweenRef.current?.ship1?.kill();
      tweenRef.current?.ship2?.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply initial Sea_weed zoom when panel first becomes active (real dimensions available)
  useEffect(() => {
    if (!active || hasInitialZoomRef.current) return;
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    const getEl = label =>
      svg.querySelector(`[inkscape\\:label="${label}"]`) ??
      svg.querySelector(`#ph__${label}`);
    const seaWeedEl = getEl('Sea_weed');
    if (seaWeedEl) {
      zoomToLayer(svg, container, seaWeedEl, { noTransition: true, maxZoom: 10 });
      hasInitialZoomRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (svg && container) {
      if (stepIndex >= 10) {
        // Read the END POINT of Ship_1_path — the path has no GSAP transforms,
        // so getScreenCTM() is accurate regardless of tween render state.
        const getEl = label =>
          svg.querySelector(`[inkscape\\:label="${label}"]`) ??
          svg.querySelector(`#ph__${label}`);
        const ship1PathEl = getEl('Ship_1_path');
        const pathEl = ship1PathEl?.tagName?.toLowerCase() === 'path'
          ? ship1PathEl : ship1PathEl?.querySelector('path');
        const vb = svg.viewBox.baseVal;
        if (pathEl && vb?.width) {
          const cW   = container.clientWidth;
          const cH   = container.clientHeight;
          const s    = Math.min(cW / vb.width, cH / vb.height);
          const offX = (cW - vb.width  * s) / 2;
          const offY = (cH - vb.height * s) / 2;
          const endPt   = pathEl.getPointAtLength(pathEl.getTotalLength());
          const svgCTM  = svg.getScreenCTM();
          const pathCTM = pathEl.getScreenCTM();
          let pivotX = endPt.x * s + offX;
          let pivotY = endPt.y * s + offY;
          if (svgCTM && pathCTM) {
            const m  = svgCTM.inverse().multiply(pathCTM);
            const pt = svg.createSVGPoint();
            pt.x = endPt.x; pt.y = endPt.y;
            const tp = pt.matrixTransform(m);
            pivotX = tp.x * s + offX;
            pivotY = tp.y * s + offY;
          }
          const zoom = 5;
          const tx = cW / 2 / zoom - pivotX;
          const ty = cH / 2 / zoom - pivotY;
          svg.style.transition = 'transform 1200ms ease-out';
          svg.style.transform  = `scale(${zoom}) translate(${tx}px,${ty}px)`;
        }
      } else {
        const dur = hasInitialZoomRef.current ? '2500ms cubic-bezier(0.25,0,0.1,1)' : '1200ms ease';
        svg.style.transition = `transform ${dur}`;
        svg.style.transform  = 'none';
        hasInitialZoomRef.current = false;
      }
    }

    const { sun, ice, o2, eddy, ship1, ship2 } = tweenRef.current ?? {};
    if (!sun) return;

    // Steps 0 and 1 are the Sea_weed intro and zoom-out — freeze at initial state
    if (stepIndex <= 1) {
      gsap.set([sun, ice, o2, eddy, ship1, ship2].filter(Boolean), { progress: 0 });
      iceShapesRef.current.forEach(({ el }) => gsap.set(el, { opacity: 1 }));
      carbonShapesRef.current.forEach(({ el }) => gsap.set(el, { opacity: 0 }));
      oilShapesRef.current.forEach(({ el }) => gsap.set(el, { opacity: 0 }));
      const { lightRay, o2: o2Fade, eddy: eddyFade } = fadeEls.current;
      gsap.set([lightRay, o2Fade, eddyFade].filter(Boolean), { opacity: 0 });
      return;
    }

    const sunP  = SUN_PROGRESS[Math.min(stepIndex, SUN_PROGRESS.length - 1)];
    const o2P   = Math.max(0, (stepIndex - O2_START) / (TOTAL_STEPS - O2_START));
    const eddyP = Math.min(Math.max(0, stepIndex - 2), 1);
    const sunOpts = { progress: sunP, duration: 1.2, ease: 'power2.inOut', overwrite: true };
    gsap.to(sun, sunOpts);
    if (ice)  gsap.to(ice,  sunOpts);
    if (o2)   gsap.to(o2,   { progress: o2P,   duration: 2.2, ease: 'power2.inOut', overwrite: true });
    if (eddy) gsap.to(eddy, { progress: eddyP, duration: 2.2, ease: 'power2.inOut', overwrite: true });

    iceShapesRef.current.forEach(({ el, threshold }) => {
      gsap.to(el, { opacity: sunP >= threshold ? 0 : 1, duration: 0.6, ease: 'power2.inOut' });
    });

    const iceGone = SUN_PROGRESS[2];
    const { lightRay, o2: o2Fade, eddy: eddyFade } = fadeEls.current;

    // Light ray fades in as ice melts
    if (lightRay) gsap.to(lightRay, { opacity: Math.min(sunP / iceGone, 1), duration: 0.8, ease: 'power2.inOut' });

    // Carbon children appear randomly between step 1 and step 2
    carbonShapesRef.current.forEach(({ el, threshold }) => {
      gsap.to(el, { opacity: sunP >= threshold ? 1 : 0, duration: 0.6, ease: 'power2.inOut' });
    });

    // O2 fades in after the sun pause, between steps 3 and 4
    const o2FadeP = Math.max(0, Math.min(1, (sunP - SUN_PROGRESS[3]) / (SUN_PROGRESS[4] - SUN_PROGRESS[3])));
    if (o2Fade)   gsap.to(o2Fade,   { opacity: o2FadeP, duration: 0.8, ease: 'power2.inOut' });

    // Eddy fades in as it drops (opacity tied to its motion progress)
    if (eddyFade) gsap.to(eddyFade, { opacity: Math.min(eddyP * 3, 1), duration: 0.8, ease: 'power2.inOut' });

    // Ships fade in and move along Ship_path at step 8
    const shipP = Math.min(Math.max(0, stepIndex - 7), 1);
    const shipDur = stepIndex === 8 ? 5.0 : 0;
    const { ship1: ship1Fade, ship2: ship2Fade } = fadeEls.current;
    if (ship1) gsap.to(ship1, { progress: shipP, duration: shipDur, ease: 'power1.inOut', overwrite: true });
    if (ship2) gsap.to(ship2, { progress: shipP, duration: shipDur, ease: 'power1.inOut', overwrite: true });
    if (ship1Fade) gsap.to(ship1Fade, { opacity: shipP, duration: 1.2, ease: 'power2.inOut' });
    if (ship2Fade) gsap.to(ship2Fade, { opacity: shipP, duration: 1.2, ease: 'power2.inOut' });

    oilShapesRef.current.forEach(({ el, threshold }) => {
      if (shipP > 0.5) {
        gsap.to(el, { opacity: 1, duration: 0.8, delay: 3 + threshold * 2, ease: 'power2.inOut', overwrite: true });
      } else {
        gsap.to(el, { opacity: 0, duration: 0.3, ease: 'power2.inOut', overwrite: true });
      }
    });
  }, [stepIndex]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
