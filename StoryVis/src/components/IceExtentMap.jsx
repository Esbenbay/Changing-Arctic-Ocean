import { useState, useEffect, useRef } from 'react';
import { track } from '../tracker.js';
import { fromArrayBuffer } from 'geotiff';

const START_YEAR = 1979;
const END_YEAR   = 2025;

function iceColor(val) {
  if (val === 1)  return [255, 255, 255, 255]; // ice — white
  if (val === 0)  return [10, 35, 70, 220];    // ocean — deep navy
  return [160, 160, 160, 255];                  // land/coast — grey
}

async function decodeIceTif(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  const image = await (await fromArrayBuffer(await r.arrayBuffer())).getImage(0);
  const srcW  = image.getWidth();
  const srcH  = image.getHeight();
  const [band] = await image.readRasters();
  const size      = srcW;
  const rowOffset = Math.floor((srcH - size) / 2);
  const canvas    = document.createElement('canvas');
  canvas.width    = size;
  canvas.height   = size;
  const ctx     = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const px      = imgData.data;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const [r, g, b, a] = iceColor(band[(row + rowOffset) * srcW + col]);
      const i = (row * size + col) * 4;
      px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export default function IceExtentMap({ getUrl, onYearChange }) {
  const canvasRef  = useRef(null);
  const requestId  = useRef(0);
  const cacheRef   = useRef(new Map());
  const [year, setYear]       = useState(START_YEAR);
  const [loading, setLoading] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  // Pre-decode all years in the background
  useEffect(() => {
    const cache = cacheRef.current;
    let cancelled = false;
    const run = async () => {
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        if (cancelled) break;
        if (cache.has(y)) continue;
        await decodeIceTif(getUrl(y)).then(c => cache.set(y, c)).catch(() => {});
      }
    };
    const t = setTimeout(run, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [getUrl]);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    const cache = cacheRef.current;
    const draw = (offscreen) => {
      if (id !== requestId.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext('2d').drawImage(offscreen, 0, 0);
      setLoading(false);
    };
    if (cache.has(year)) {
      draw(cache.get(year));
    } else {
      decodeIceTif(getUrl(year))
        .then(c => { cache.set(year, c); draw(c); })
        .catch(() => setLoading(false));
    }
  }, [year, getUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Canvas — circular clip makes it look like a globe from above */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            opacity: loading ? 0.4 : 1,
            transition: 'opacity 1000ms',
          }}
        />
        {/* Year label centred over the canvas */}
        <div style={{
          position: 'absolute', bottom: '8%', left: 0, right: 0,
          textAlign: 'center',
          fontSize: '1.4rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.9)',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          fontVariantNumeric: 'tabular-nums',
          pointerEvents: 'none',
        }}>
          {year}
        </div>
      </div>

      {/* Year slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1rem', color: '#000000ff', flexShrink: 0 }}>{START_YEAR}</span>
        <input
          type="range"
          min={START_YEAR}
          max={END_YEAR}
          value={year}
          onMouseDown={() => setHasDragged(true)}
          onTouchStart={() => setHasDragged(true)}
          onChange={e => { const y = Number(e.target.value); setYear(y); onYearChange?.(y); track('ice_slider', { year: y }); }}
          style={{
            flex: 1,
            animation: !hasDragged ? 'dragPulse 1.4s ease-in-out infinite' : 'none',
            borderRadius: 4,
          }}
        />
        <span style={{ fontSize: '1rem', color: '#000000ff', flexShrink: 0 }}>{END_YEAR}</span>
      </div>

    </div>
  );
}
