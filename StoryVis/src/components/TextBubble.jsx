// `direction` is where the tip POINTS: 'right' | 'left' | 'bottom' | 'top'
function ArrowTip({ direction }) {
  if (!direction) return null;
  const fill = 'rgba(255,255,255,0.97)';
  const s = 9;
  const base = { position: 'absolute', width: 0, height: 0 };
  const tips = {
    right:  { ...base, right:  -(s * 2), top: '50%', marginTop:  -s, borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderLeft:  `${s * 2}px solid ${fill}` },
    left:   { ...base, left:   -(s * 2), top: '50%', marginTop:  -s, borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderRight: `${s * 2}px solid ${fill}` },
    bottom: { ...base, bottom: -(s * 2), left: '50%', marginLeft: -s, borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderTop:   `${s * 2}px solid ${fill}` },
    top:    { ...base, top:    -(s * 2), left: '50%', marginLeft: -s, borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderBottom:`${s * 2}px solid ${fill}` },
  };
  return <div style={tips[direction] ?? null} />;
}

// `text` can be a plain string OR an array of strings / { image, alt?, caption? } objects.
function BubbleContent({ text }) {
  if (!text) return null;
  const items = Array.isArray(text) ? text : [text];
  return (
    <>
      {items.map((item, i) => {
        if (typeof item === 'string') {
          return (
            <div key={i} style={{ fontSize: '1.2rem', lineHeight: 1.65, color: '#3d5166', marginBottom: 8 }}>
              {item}
            </div>
          );
        }
        if (item?.image && item?.text) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '10px 0' }}>
              <img
                src={item.image}
                alt={item.alt ?? ''}
                style={{ width: item.imageWidth ?? '45%', flexShrink: 0, borderRadius: 7, display: 'block', objectFit: 'cover', height: item.imageHeight ?? 'auto' }}
              />
              <div>
                <div style={{ fontSize: '1.2rem', lineHeight: 1.65, color: '#3d5166' }}>{item.text}</div>
                {item.caption && (
                  <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 4, fontStyle: 'italic' }}>{item.caption}</div>
                )}
              </div>
            </div>
          );
        }
        if (item?.image) {
          return (
            <div key={i} style={{ margin: '10px 0' }}>
              <img
                src={item.image}
                alt={item.alt ?? ''}
                style={{ width: '95%', height: '90%', borderRadius: 7, display: 'block', objectFit: 'cover' }}
              />
              {item.caption && (
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
                  {item.caption}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

// `bubble` shape: { x, y, align, arrow?, title, text, figure?, cta?, onCta? }
// Renders only when an anchor position is known — x/y come from the SVG dot.
export default function TextBubble({ title, text, x, y, arrow, figure, width, cta, onCta }) {
  const hasFigure = Boolean(figure);
  const hasCta    = Boolean(cta && onCta);
  const w = width ?? (hasFigure ? 400 : undefined);
  return (
    <div style={{
      position:             'fixed',
      left:                 `${x}%`,
      top:                  `${y}%`,
      transform:            'translate(-50%, -50%)',
      zIndex:               20,
      width:                w,
      maxWidth:             w ?? 450,
      background:           'rgba(255,255,255,0.95)',
      backdropFilter:       'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius:         14,
      padding:              '10px 15px',
      boxShadow:            '0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
      pointerEvents:        (hasFigure || hasCta) ? 'auto' : 'none',
      animation:            'story-fade-in 400ms ease forwards',
    }}>
      <ArrowTip direction={arrow} />
      {title && (
        <div style={{ fontWeight: 700, fontSize: '1.35rem', marginBottom: 7, color: '#12263a', letterSpacing: '-0.01em' }}>
          {title}
        </div>
      )}
      <BubbleContent text={text} />
      {hasFigure && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
          {figure}
        </div>
      )}
      {hasCta && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onCta}
            style={{
              padding:       '8px 18px',
              borderRadius:  7,
              border:        'none',
              background:    '#2c7fb8',
              color:         'white',
              fontSize:      '0.85rem',
              fontWeight:    600,
              cursor:        'pointer',
              letterSpacing: '0.02em',
              transition:    'background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a5f8a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2c7fb8'; }}
          >
            {cta}
          </button>
        </div>
      )}
    </div>
  );
}
