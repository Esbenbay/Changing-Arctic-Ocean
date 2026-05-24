import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

const SR_PREFIX = 'sr__';

const srGetEl = (svg, label) =>
  svg.querySelector(`[inkscape\\:label="${label}"]`) ??
  svg.querySelector(`#${SR_PREFIX}${label}`);

const parseViewBox = svg => {
  const vb = svg.getAttribute('viewBox')?.split(' ').map(Number);
  return vb ? { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } : null;
};

export default function ShippingRoutesPanel({ active, stepIndex }) {
  const containerRef  = useRef(null);
  const svgRef        = useRef(null);
  const origVBRef     = useRef(null);
  const vbTweenRef    = useRef(null);
  const shipTweenRef  = useRef(null);
  const activeRef     = useRef(active);
  activeRef.current   = active;
  const stepRef       = useRef(stepIndex);
  stepRef.current     = stepIndex;

  const applyStep = (svg, step) => {
    const orig = origVBRef.current;
    if (!orig) return;

    vbTweenRef.current?.kill();

    if (step === 0) {
      const ship1El = srGetEl(svg, 'Ship-1');
      let cx = orig.x + orig.w / 2;
      let cy = orig.y + orig.h / 2;

      if (ship1El) {
        const bbox   = ship1El.getBBox();
        const svgCTM = svg.getScreenCTM();
        const elCTM  = ship1El.getScreenCTM();
        if (svgCTM && elCTM) {
          const m  = svgCTM.inverse().multiply(elCTM);
          const pt = svg.createSVGPoint();
          pt.x = bbox.x + bbox.width  / 2;
          pt.y = bbox.y + bbox.height / 2;
          const tp = pt.matrixTransform(m);
          cx = tp.x; cy = tp.y;
        } else {
          cx = bbox.x + bbox.width  / 2;
          cy = bbox.y + bbox.height / 2;
        }
      }

      const zoom = 10;
      const zW = orig.w / zoom;
      const zH = orig.h / zoom;
      svg.setAttribute('viewBox', `${cx - zW / 2} ${cy - zH / 2} ${zW} ${zH}`);

    } else {
      const cur = parseViewBox(svg) ?? orig;
      const state = { ...cur };

      const targetZoom = 2;
      const tW = orig.w / targetZoom;
      const tH = orig.h / targetZoom;

      const zoomPointEl = srGetEl(svg, 'Zoom_point');
      let zoomCX = orig.x + orig.w / 2;
      let zoomCY = orig.y + orig.h / 2;
      if (zoomPointEl) {
        const bbox = zoomPointEl.getBBox();
        zoomCX = bbox.x + bbox.width  / 2;
        zoomCY = bbox.y + bbox.height / 2;
      }
      const tX = zoomCX - tW / 2;
      const tY = zoomCY - tH / 2;

      vbTweenRef.current = gsap.to(state, {
        x: tX, y: tY, w: tW, h: tH,
        duration: 5,
        ease: 'power2.inOut',
        delay: 0.2,
        onUpdate: () => svg.setAttribute('viewBox', `${state.x} ${state.y} ${state.w} ${state.h}`),
      });

      const routesEl = srGetEl(svg, 'Routes.');
      if (routesEl) gsap.to(routesEl, { opacity: 1, duration: 1.8, delay: 1.0, ease: 'power2.inOut' });

      const shipP = Math.min(Math.max(0, step - 1), 1);
      const ship  = shipTweenRef.current;
      if (ship) gsap.to(ship, { progress: shipP, duration: 4.0, ease: 'power1.inOut', overwrite: true });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    fetch('/Transpolar_shipping_routes.svg')
      .then(r => r.text())
      .then(svgText => {
        if (!containerRef.current) return;
        container.innerHTML = svgText;
        const svg = container.querySelector('svg');
        if (!svg) return;
        svg.style.width  = '100%';
        svg.style.height = '100%';

        svg.querySelectorAll('[id]').forEach(el => { el.id = SR_PREFIX + el.id; });
        svg.querySelectorAll('*').forEach(el => {
          ['fill', 'stroke', 'filter', 'clip-path', 'mask'].forEach(attr => {
            const v = el.getAttribute(attr);
            if (v) el.setAttribute(attr, v.replace(/url\(#([^)]+)\)/g, `url(#${SR_PREFIX}$1)`));
          });
          const s = el.getAttribute('style');
          if (s) el.setAttribute('style', s.replace(/url\(#([^)]+)\)/g, `url(#${SR_PREFIX}$1)`));
        });
        const styleEl = svg.querySelector('style');
        if (styleEl) styleEl.textContent = styleEl.textContent.replace(/#([\w-]+)/g, (match, id) =>
          /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(id) ? match : `#${SR_PREFIX}${id}`);

        const vb = svg.viewBox.baseVal;
        origVBRef.current = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
        svgRef.current = svg;

        const ship1El = srGetEl(svg, 'Ship-1');
        const pathEl  = srGetEl(svg, 'Path1') ?? srGetEl(svg, 'path1') ?? srGetEl(svg, 'Path_1');
        const shipPath = pathEl?.tagName?.toLowerCase() === 'path' ? pathEl : pathEl?.querySelector('path');

        if (ship1El && shipPath) {
          const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          ship1El.parentNode.insertBefore(w, ship1El);
          w.appendChild(ship1El);
          shipTweenRef.current = gsap.to(w, {
            motionPath: { path: shipPath, align: shipPath, alignOrigin: [0.5, 0.5], autoRotate: true },
            duration: 1, ease: 'none', paused: true,
          });
        }

        const routesEl = srGetEl(svg, 'Routes.');
        if (routesEl) gsap.set(routesEl, { opacity: 0 });

        if (activeRef.current) applyStep(svg, stepRef.current);
      });

    return () => {
      vbTweenRef.current?.kill();
      shipTweenRef.current?.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active || !svgRef.current) return;
    applyStep(svgRef.current, stepIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
