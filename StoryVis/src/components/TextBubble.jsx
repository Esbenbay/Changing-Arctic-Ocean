import { useLayoutEffect, useState, useRef } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const unique = (items) => [...new Set(items.filter(Boolean))];
const viewportRatio = (viewport, desktop, laptop, compact, tight) => (
  viewport.width < 640 || viewport.height < 560
    ? tight
    : viewport.width < 900 || viewport.height < 680
      ? compact
      : viewport.width <= 1536 || viewport.height <= 960
        ? laptop
        : desktop
);

const preferredSideFromArrow = {
  right:  'left',
  left:   'right',
  bottom: 'top',
  top:    'bottom',
};

const arrowFromSide = {
  left:   'right',
  right:  'left',
  top:    'bottom',
  bottom: 'top',
};

const sidePosition = (side, referenceLeft, referenceTop, width, height, gap, referenceRect) => {
  const rectCenterX = referenceRect ? (referenceRect.left + referenceRect.right) / 2 : referenceLeft;
  const rectCenterY = referenceRect ? (referenceRect.top + referenceRect.bottom) / 2 : referenceTop;
  switch (side) {
    case 'left':
      return { left: (referenceRect?.left ?? referenceLeft) - width / 2 - gap, top: rectCenterY };
    case 'right':
      return { left: (referenceRect?.right ?? referenceLeft) + width / 2 + gap, top: rectCenterY };
    case 'top':
      return { left: rectCenterX, top: (referenceRect?.top ?? referenceTop) - height / 2 - gap };
    case 'bottom':
      return { left: rectCenterX, top: (referenceRect?.bottom ?? referenceTop) + height / 2 + gap };
    default:
      return { left: rectCenterX, top: rectCenterY };
  }
};

const inflateRect = (rect, amount) => rect ? ({
  left: rect.left - amount,
  right: rect.right + amount,
  top: rect.top - amount,
  bottom: rect.bottom + amount,
}) : null;

const overlapArea = (a, b) => {
  if (!a || !b) return 0;
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
};

const chooseBubblePlacement = ({
  anchorLeft,
  anchorTop,
  measuredWidth,
  measuredHeight,
  viewport,
  margin,
  bottomReserve,
  gap,
  arrow,
  avoidRect,
}) => {
  const minLeft = margin + measuredWidth / 2;
  const maxLeft = viewport.width - margin - measuredWidth / 2;
  const minTop = margin + measuredHeight / 2;
  const maxTop = viewport.height - bottomReserve - margin - measuredHeight / 2;
  const paddedAvoidRect = inflateRect(avoidRect, gap);
  const referenceLeft = paddedAvoidRect ? (paddedAvoidRect.left + paddedAvoidRect.right) / 2 : anchorLeft;
  const referenceTop = paddedAvoidRect ? (paddedAvoidRect.top + paddedAvoidRect.bottom) / 2 : anchorTop;
  const preferredSide = preferredSideFromArrow[arrow]
    ?? (referenceLeft > viewport.width * 0.58 ? 'left' : 'right');
  const sides = unique([
    preferredSide,
    preferredSide === 'left' ? 'right' : preferredSide === 'right' ? 'left' : null,
    preferredSide === 'top' ? 'bottom' : preferredSide === 'bottom' ? 'top' : null,
    'left',
    'right',
    'top',
    'bottom',
    'center',
  ]);

  let best = null;
  sides.forEach((side, index) => {
    const desired = sidePosition(side, referenceLeft, referenceTop, measuredWidth, measuredHeight, gap, paddedAvoidRect);
    const left = clamp(desired.left, minLeft, maxLeft);
    const top = clamp(desired.top, minTop, maxTop);
    const rect = {
      left: left - measuredWidth / 2,
      right: left + measuredWidth / 2,
      top: top - measuredHeight / 2,
      bottom: top + measuredHeight / 2,
    };
    const overlap = overlapArea(rect, paddedAvoidRect);
    const coversAnchor = (
      anchorLeft >= rect.left - gap &&
      anchorLeft <= rect.right + gap &&
      anchorTop >= rect.top - gap &&
      anchorTop <= rect.bottom + gap
    );
    const clampedDistance = Math.hypot(left - desired.left, top - desired.top);
    const referenceDistance = Math.hypot(left - referenceLeft, top - referenceTop);
    const score = clampedDistance * 2 + overlap * 4 + (coversAnchor ? 900 : 0) - referenceDistance * 0.03 + index;
    if (!best || score < best.score) best = { left, top, side, score };
  });

  return best ?? {
    left: clamp(anchorLeft, minLeft, maxLeft),
    top: clamp(anchorTop, minTop, maxTop),
    side: 'center',
  };
};

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



export default function TextBubble({ title, text, x, y, arrow, figure, width, cta, onCta, avoidRect, offsetX = 0, offsetY = 0, figureScale = 1, minScaleOverride, fontScale = 1 }) {
  const bubbleRef = useRef(null);
  const viewport = useViewportSize();
  const [bubbleSize, setBubbleSize] = useState({ width: 0, height: 0 });
  const hasFigure = Boolean(figure);
  const hasCta    = Boolean(cta && onCta);
  const tight = viewport.width < 640 || viewport.height < 560;
  const compact = viewport.width < 900 || viewport.height < 680;
  const laptop = viewport.width <= 1536 || viewport.height <= 960;
  const margin = tight ? 10 : compact ? 14 : laptop ? 16 : 18;
  const bottomReserve = 76;
  const preferredWidth = width
    ? Math.min(width, tight ? 300 : compact ? 350 : laptop ? 410 : width)
    : hasFigure
      ? (tight ? 265 : compact ? 310 : laptop ? 360 : 400)
      : (tight ? 255 : compact ? 300 : laptop ? 355 : 450);
  const widthRatio = width
    ? viewportRatio(viewport, 0.40, 0.31, 0.345, 0.70)
    : hasFigure
      ? viewportRatio(viewport, 0.34, 0.30, 0.345, 0.68)
      : viewportRatio(viewport, 0.32, 0.29, 0.33, 0.66);
  const minimumWidth = tight ? 190 : compact ? 220 : laptop ? 260 : 300;
  const responsiveWidth = viewport.width * widthRatio;
  const bubbleWidth = clamp(
    responsiveWidth,
    Math.min(minimumWidth, viewport.width - margin * 2),
    Math.min(preferredWidth, viewport.width - margin * 2)
  );
  const heightRatio = viewportRatio(viewport, 0.62, 0.42, 0.38, 0.32);
  const maxBubbleHeight = clamp(
    viewport.height * heightRatio,
    Math.min(190, viewport.height - bottomReserve - margin * 2),
    viewport.height - bottomReserve - margin * 2
  );
  const minScale = minScaleOverride ?? (tight ? 0.58 : compact ? 0.66 : laptop ? 0.78 : 0.92);
  const rawMeasuredWidth = bubbleSize.width || bubbleWidth;
  const rawMeasuredHeight = bubbleSize.height || 180;
  const contentScale = clamp(maxBubbleHeight / rawMeasuredHeight, minScale, 1);
  const measuredWidth = rawMeasuredWidth * contentScale;
  const measuredHeight = rawMeasuredHeight * contentScale;
  const anchorLeft = viewport.width * ((x + offsetX) / 100);
  const anchorTop = viewport.height * ((y + offsetY) / 100);
  const gap = tight ? 12 : compact ? 14 : laptop ? 16 : 20;
  // Keep authored bubble anchor positions across laptop sizes; only the box/font scales down.
  const legacyFloating = true;
  const placement = legacyFloating ? null : chooseBubblePlacement({
    anchorLeft,
    anchorTop,
    measuredWidth,
    measuredHeight,
    viewport,
    margin,
    bottomReserve,
    gap,
    arrow,
    avoidRect,
  });
  const legacyLeft = clamp(anchorLeft, margin + measuredWidth / 2, viewport.width - margin - measuredWidth / 2);
  const legacyTop = clamp(anchorTop, margin + measuredHeight / 2, viewport.height - bottomReserve - margin - measuredHeight / 2);
  const left = legacyFloating ? legacyLeft : placement.left;
  const top = legacyFloating ? legacyTop : placement.top;
  const wasLegacyNudged = Math.abs(left - anchorLeft) > 6 || Math.abs(top - anchorTop) > 6;
  const visibleArrow = legacyFloating
    ? (wasLegacyNudged ? null : arrow)
    : (compact || placement.side === 'center' ? null : (arrow ?? arrowFromSide[placement.side]));
  const bodyFontRem = tight ? 0.67 : compact ? 0.75 : laptop ? 0.87 : 1.2;
  const titleFontRem = tight ? 0.77 : compact ? 0.88 : laptop ? 1.02 : 1.35;
  const bodyFontSize = `${bodyFontRem * fontScale}rem`;
  const titleFontSize = `${titleFontRem * fontScale}rem`;
  const bodyLineHeight = tight ? 1.24 : compact ? 1.31 : laptop ? 1.39 : 1.65;

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
      borderRadius:         tight ? 7 : compact ? 9 : laptop ? 10 : 14,
      padding:              tight ? '5px 7px' : compact ? '6px 8px' : laptop ? '7px 9px' : '10px 15px',
      boxShadow:            '0 10px 30px rgba(18,38,58,0.18), 0 1px 4px rgba(0,0,0,0.10)',
      pointerEvents:        (hasFigure || hasCta) ? 'auto' : 'none',
      animation:            'story-fade-in 400ms ease forwards',
    }}>
      <ArrowTip direction={visibleArrow} />
      {title && (
        <div style={{ fontWeight: 700, fontSize: titleFontSize, marginBottom: tight ? 5 : 7, color: '#12263a', letterSpacing: 0, lineHeight: 1.2 }}>
          {title}
        </div>
      )}
      <BubbleContent text={text} compact={compact} bodyFontSize={bodyFontSize} bodyLineHeight={bodyLineHeight} />
      {hasFigure && (
        <div style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          paddingTop: compact ? 9 : 12,
        }}>
          <div style={{ width: `${figureScale * 100}%`, margin: '0 auto' }}>
            {figure}
          </div>
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
