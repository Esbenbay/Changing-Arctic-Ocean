import { useState } from 'react';
import { CHAPTERS } from '../story-data.js';

export default function ChapterTimeline({ currentChapter, onNavigate }) {
  const [hoveredId, setHoveredId] = useState(null);
  const currentIndex = CHAPTERS.findIndex(c => c.id === currentChapter);
  return (
    <div style={{
      position:       'fixed',
      bottom:         0,
      left:           0,
      right:          0,
      zIndex:         200,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-evenly',
      background:     '#ffffff',
      borderTop:      '2px solid #e8e8e8',
      padding:        '14px 90px',
      userSelect:     'none',
    }}>
      {CHAPTERS.map((ch, i) => {
        const isActive  = i === currentIndex;
        const isPast    = i < currentIndex;
        const isHovered = hoveredId === ch.id;
        const dotColor   = isActive || isHovered ? '#2c7fb8' : isPast ? '#90bcd8' : '#d0d0d0';
        const labelColor = isActive ? '#12263a' : isHovered ? '#2c7fb8' : isPast ? '#7fa8c0' : '#b0b0b0';
        return [
          i > 0 && (
            <div key={`line-${ch.id}`} style={{
              flex:       1,
              height:     1.5,
              background: isPast || isActive ? '#90bcd8' : '#ddd',
              transition: 'background 500ms ease',
            }} />
          ),
          <div
            key={ch.id}
            onClick={() => onNavigate(ch.id)}
            onMouseEnter={() => setHoveredId(ch.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           6,
              cursor:        'pointer',
              transform:     isHovered ? 'translateY(-3px)' : 'translateY(0)',
              transition:    'transform 200ms ease',
              flexShrink:    0,
            }}
          >
            <div style={{
              width:        isActive || isHovered ? 13 : 9,
              height:       isActive || isHovered ? 13 : 9,
              borderRadius: '50%',
              background:   dotColor,
              boxShadow:    isActive ? '0 0 0 4px rgba(44,127,184,0.18)' : isHovered ? '0 0 0 3px rgba(44,127,184,0.12)' : 'none',
              transition:   'all 250ms ease',
            }} />
            <span style={{
              fontSize:      '0.68rem',
              fontWeight:    isActive || isHovered ? 700 : 400,
              color:         labelColor,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace:    'nowrap',
              transition:    'all 250ms ease',
            }}>
              {ch.label}
            </span>
          </div>,
        ];
      })}
    </div>
  );
}
