import { useState } from 'react';
import { trackEvent } from '../tracker.js';

export default function ErosionSlider({ onChange }) {
  const [value, setValue] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);
  const handle = e => {
    const v = Number(e.target.value) / 100;
    setValue(Number(e.target.value));
    onChange(v);
  };
  const handleDragEnd = () => {
    trackEvent('erosion_drag_complete', { value });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555' }}>
        <span>Sea Ice</span><span>Turbidity</span>
      </div>
      <div style={{ position: 'relative', padding: '2px 0' }}>
        <input
          className={`story-range ${!hasDragged ? 'needs-interaction' : ''}`}
          type="range" min={0} max={100} value={value}
          onMouseDown={() => setHasDragged(true)}
          onTouchStart={() => setHasDragged(true)}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          onChange={handle}
          style={{
            '--range-progress': `${value}%`,
          }}
        />
      </div>
    </div>
  );
}
