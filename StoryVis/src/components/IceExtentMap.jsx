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

export default function IceExtentMap({ getUrl, onYearChange }) {
  const canvasRef = useRef(null);
  const requestId = useRef(0);
  const [year, setYear]       = useState(START_YEAR);
  const [loading, setLoading] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);

    fetch(getUrl(year))
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer(); })
      .then(async buf => {
        const image = await (await fromArrayBuffer(buf)).getImage(0);
        const srcW  = image.getWidth();
        const srcH  = image.getHeight();
        const [band] = await image.readRasters();

        if (id !== requestId.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render a square crop centered vertically so the circle clip shows the full Arctic
        const size      = srcW; // 304 — square
        const rowOffset = Math.floor((srcH - size) / 2); // center crop

        canvas.width  = size;
        canvas.height = size;
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
