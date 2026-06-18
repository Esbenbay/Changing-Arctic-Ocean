import { useLayoutEffect, useState, useRef } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const viewportRatio = (viewport, desktop, compact, tight) => (
  viewport.width < 560 || viewport.height < 560
    ? tight
    : viewport.width < 820 || viewport.height < 680
      ? compact
      : desktop
);

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width:  window.innerWidth,
    height: window.innerHeight,
  }));

  useLayoutEffect(() => {
    const update = () => setSize({
      width:  window.innerWidth,
      height: window.innerHeight,
    });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

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


function BubbleContent({ text, compact, bodyFontSize, bodyLineHeight }) {
  if (!text) return null;
  const items = Array.isArray(text) ? text : [text];
  return (
    <>
      {items.map((item, i) => {
        if (typeof item === 'string') {
          return (
            <div className="story-body-text" key={i} style={{ fontSize: bodyFontSize, lineHeight: bodyLineHeight, color: '#2f4356', marginBottom: compact ? 6 : 8, whiteSpace: 'pre-line' }}>
              {item}
            </div>
          );
        }
        if (item?.image && item?.text) {
          return (
            <div key={i} style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: compact ? 8 : 10, alignItems: 'flex-start', margin: compact ? '8px 0' : '10px 0' }}>
              <img
                src={item.image}
                alt={item.alt ?? ''}
                style={{ width: compact ? '100%' : item.imageWidth ?? '45%', maxHeight: compact ? 170 : 240, flexShrink: 0, borderRadius: 7, display: 'block', objectFit: 'cover', height: item.imageHeight ?? 'auto' }}
              />
              <div>
                <div className="story-body-text" style={{ fontSize: bodyFontSize, lineHeight: bodyLineHeight, color: '#2f4356', whiteSpace: 'pre-line' }}>{item.text}</div>
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
                style={{ width: '100%', maxHeight: compact ? 190 : 280, borderRadius: 7, display: 'block', objectFit: 'cover' }}
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



export default function TextBubble({ title, text, x, y, arrow, figure, width, cta, onCta }) {
  const bubbleRef = useRef(null);
  const viewport = useViewportSize();
  const [bubbleSize, setBubbleSize] = useState({ width: 0, height: 0 });
  const hasFigure = Boolean(figure);
  const hasCta    = Boolean(cta && onCta);
  const compact = viewport.width < 820 || viewport.height < 680;
  const tight = viewport.width < 560 || viewport.height < 560;
  const margin = tight ? 10 : compact ? 14 : 18;
  const bottomReserve = 76;
  const preferredWidth = width ?? (hasFigure ? 400 : 450);
  const widthRatio = width
    ? viewportRatio(viewport, 0.40, 0.48, 0.88)
    : hasFigure
      ? viewportRatio(viewport, 0.34, 0.46, 0.88)
      : viewportRatio(viewport, 0.32, 0.42, 0.86);
  const minimumWidth = tight ? 230 : compact ? 260 : 300;
  const responsiveWidth = viewport.width * widthRatio;
  const bubbleWidth = clamp(
    responsiveWidth,
    Math.min(minimumWidth, viewport.width - margin * 2),
    Math.min(preferredWidth, viewport.width - margin * 2)
  );
  const heightRatio = viewportRatio(viewport, 0.62, 0.52, 0.44);
  const maxBubbleHeight = clamp(
    viewport.height * heightRatio,
    Math.min(190, viewport.height - bottomReserve - margin * 2),
    viewport.height - bottomReserve - margin * 2
  );
  const minScale = tight ? 0.68 : compact ? 0.80 : 0.92;
  const rawMeasuredWidth = bubbleSize.width || bubbleWidth;
  const rawMeasuredHeight = bubbleSize.height || 180;
  const contentScale = clamp(maxBubbleHeight / rawMeasuredHeight, minScale, 1);
  const measuredWidth = rawMeasuredWidth * contentScale;
  const measuredHeight = rawMeasuredHeight * contentScale;
  const anchorLeft = viewport.width * (x / 100);
  const anchorTop = viewport.height * (y / 100);
  const left = clamp(anchorLeft, margin + measuredWidth / 2, viewport.width - margin - measuredWidth / 2);
  const top = clamp(anchorTop, margin + measuredHeight / 2, viewport.height - bottomReserve - margin - measuredHeight / 2);
  const wasNudged = Math.abs(left - anchorLeft) > 6 || Math.abs(top - anchorTop) > 6;
  const bodyFontSize = tight ? '0.98rem' : compact ? '1.08rem' : '1.2rem';
  const titleFontSize = tight ? '1.08rem' : compact ? '1.18rem' : '1.35rem';
  const bodyLineHeight = tight ? 1.45 : compact ? 1.52 : 1.65;

  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return undefined;
    const update = () => {
      const width = node.offsetWidth;
      const height = node.scrollHeight;
      setBubbleSize(current => (
        Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
          ? current
          : { width, height }
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text, title, figure, cta, bubbleWidth, bodyFontSize, titleFontSize]);

  return (
    <div ref={bubbleRef} style={{
      position:             'fixed',
      left,
      top,
      transform:            `translate(-50%, -50%) scale(${contentScale})`,
      transformOrigin:      'center',
      zIndex:               20,
      width:                bubbleWidth,
      maxWidth:             `calc(100vw - ${margin * 2}px)`,
      background:           'rgba(255,255,255,0.88)',
      backdropFilter:       'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius:         tight ? 10 : 14,
      padding:              tight ? '8px 11px' : compact ? '9px 13px' : '10px 15px',
      boxShadow:            '0 10px 30px rgba(18,38,58,0.18), 0 1px 4px rgba(0,0,0,0.10)',
      pointerEvents:        (hasFigure || hasCta) ? 'auto' : 'none',
      animation:            'story-fade-in 400ms ease forwards',
    }}>
      <ArrowTip direction={compact || wasNudged ? null : arrow} />
      {title && (
        <div style={{ fontWeight: 700, fontSize: titleFontSize, marginBottom: tight ? 5 : 7, color: '#12263a', letterSpacing: 0, lineHeight: 1.2 }}>
          {title}
        </div>
      )}
      <BubbleContent text={text} compact={compact} bodyFontSize={bodyFontSize} bodyLineHeight={bodyLineHeight} />
      {hasFigure && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: compact ? 9 : 12 }}>
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
