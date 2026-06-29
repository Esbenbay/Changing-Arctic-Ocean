import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import gsap from 'gsap';

const BASE = import.meta.env.BASE_URL;

const CAMERAS = {
  overview: { scaleFactor: 0.86 },
  shelf:    { scaleFactor: 1.10 },
};

function makeProj(w, h, cam) {
  return d3.geoAzimuthalEquidistant()
    .rotate([0, -90])
    .translate([w / 2, h / 2])
    .scale(Math.min(w, h) * cam.scaleFactor);
}

function drawBase(canvas, w, h, land, shelf, cam, highlightShelf) {
  if (w <= 0 || h <= 0 || !land) return;

  const dpr = window.devicePixelRatio || 1;
  const cw  = Math.round(w * dpr);
  const ch  = Math.round(h * dpr);

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width  = cw;
    canvas.height = ch;
  }

  const ctx  = canvas.getContext('2d');
  const proj = makeProj(w, h, cam);
  const path = d3.geoPath(proj, ctx);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';

  ctx.fillStyle = '#1a4a7a';
  ctx.fillRect(0, 0, w, h);

  if (shelf) {
    if (highlightShelf) {
      ctx.save();
      ctx.shadowColor = '#7ab8de';
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      path(shelf);
      ctx.fillStyle = '#aad4ec';
      ctx.fill('evenodd');
      ctx.restore();
    }
    ctx.beginPath();
    path(shelf);
    ctx.fillStyle = highlightShelf ? '#aad4ec' : '#7ab8de';
    ctx.fill('evenodd');
  }

  ctx.beginPath();
  path(land);
  ctx.fillStyle = '#e8e4dc';
  ctx.fill('evenodd');

  ctx.beginPath();
  path(land);
  ctx.lineWidth   = 0.5;
  ctx.strokeStyle = '#aaa';
  ctx.stroke();

  ctx.beginPath();
  path(d3.geoGraticule10());
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 0.3;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default function ArcticPolarMap({ step }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const worldRef     = useRef(null);
  const shelfRef     = useRef(null);
  const sizeRef      = useRef(null);
  const camRef       = useRef({ ...CAMERAS.overview });
  const animRef      = useRef(null);
  const redrawRef    = useRef(() => {});

  const redraw = useCallback(() => {
    const size = sizeRef.current;
    if (!size || !canvasRef.current) return;
    const highlightShelf = step === 'shelf';
    drawBase(canvasRef.current, size.w, size.h, worldRef.current, shelfRef.current, camRef.current, highlightShelf);
  }, [step]);

  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  useEffect(() => {
    const target = CAMERAS[step] || CAMERAS.overview;
    animRef.current?.kill();
    animRef.current = gsap.to(camRef.current, {
      scaleFactor: target.scaleFactor,
      duration:    2.2,
      ease:        'expo.inOut',
      onUpdate:    () => redraw(),
    });
  }, [step, redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    fetch(`${BASE}land-50m.json`)
      .then(r => r.json())
      .then(topo => {
        worldRef.current = feature(topo, topo.objects.land);
        if (sizeRef.current) redrawRef.current();
      })
      .catch(() => {});

    fetch(`${BASE}0_200m_final.geojson`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        shelfRef.current = data.features[0];
        if (sizeRef.current) redrawRef.current();
      })
      .catch(() => {});

    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect;
      sizeRef.current = { w, h };
      redrawRef.current();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      animRef.current?.kill();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}
