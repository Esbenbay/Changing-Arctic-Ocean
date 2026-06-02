import { useState, useEffect, useRef } from 'react';

const BASE = import.meta.env.BASE_URL;

const FRAMES = [
  { src: `${BASE}Images/2022-05-29.jpg`, label: 'May 29'  },
  // { src: `${BASE}Images/2022-06-03.jpg`, label: 'June 2'  },
  { src: `${BASE}Images/2022-06-02.jpg`, label: 'June 3'  },
  { src: `${BASE}Images/2022-06-22.jpg`, label: 'June 22' },
  // { src: `${BASE}Images/2022-07-07.jpg`, label: 'July 7'  },
  // { src: `${BASE}Images/2022-07-09.jpg`, label: 'July 9'  },
  // { src: `${BASE}Images/2022-08-31.jpg`, label: 'August 31'  },
];

const HOLD_MS = 200;
const CROSSFADE_MS = 1000;
const EXIT_FADE_MS = 2500;
const ZOOM_MS      = HOLD_MS + CROSSFADE_MS; // Ken Burns duration — spans full visible time per frame

export default function FrontPage({ onStart, fading }) {
  const [cycling,     setCycling]     = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const allLoaded = loadedCount >= FRAMES.length;
  const onStartRef = useRef(onStart);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);

  // Single interval owns the whole cycling run — fires at exact HOLD_MS intervals
  useEffect(() => {
  if (!cycling) return;

  let idx = 0;
  let timeoutId;

  const nextFrame = () => {
    // Frame 0 has no fade-in, so add CROSSFADE_MS to its hold to match other frames
    const isLast = idx === FRAMES.length - 1;
    const hold = idx === 0 ? HOLD_MS + CROSSFADE_MS : isLast ? 0 : HOLD_MS;
    timeoutId = setTimeout(() => {
      idx += 1;

      if (idx >= FRAMES.length) {
        onStartRef.current?.();
        return;
      }

      setActiveIdx(idx);
      timeoutId = setTimeout(nextFrame, CROSSFADE_MS);
    }, hold);
  };

  nextFrame();

  return () => clearTimeout(timeoutId);
}, [cycling]);

  return (
    <section className={`hero${fading ? ' is-fading' : ''}`}>

      {/* Image stack — frame 0 visible on landing, crossfades during cycling */}
      {FRAMES.map(({ src }, i) => {
        const isActiveFrame = i === activeIdx;
        return (
          <img
            key={src}
            src={src}
            alt=""
            onLoad={() => setLoadedCount(n => n + 1)}
            style={{
              position:      'absolute',
              inset:         0,
              width:         '100%',
              height:        '100%',
              objectFit:     'cover',
              opacity:       fading ? 0 : i <= activeIdx ? 1 : 0,
              zIndex:        isActiveFrame ? 1 : 0,
              transform:     cycling ? 'scale(1.030)' : 'scale(1)',
              // filter:        i > activeIdx ? 'blur(1.2px)' : 'blur(0px)',
              transition:    fading
                ? (isActiveFrame ? `opacity ${EXIT_FADE_MS}ms ease-out` : 'none')
                : cycling
                ? `opacity ${CROSSFADE_MS}ms ease-in-out , filter ${CROSSFADE_MS}ms ease-in-out`
                : 'none',
              pointerEvents: 'none',
              userSelect:    'none',
            }}
          />
        );
      })}

      {/* Title + CTA — fades out when cycling starts */}
      <div style={{
        position:       'relative',
        zIndex:         1,
        width:          '100%',
        height:         '100%',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        alignItems:     'center',
        opacity:        cycling ? 0 : 1,
        transition:     'opacity 1000ms ease',
        pointerEvents:  cycling ? 'none' : 'auto',
      }}>
        <h1 style={{ fontSize: '5em', marginBottom: '40px' }}>
          A Changing Arctic Ocean
        </h1>
        <p style={{ fontSize: '2em', textAlign: 'center', maxWidth: '700px' }}>
          Explore the Arctic Ocean through our interactive storytelling visualization.
          Dive into the unique features, ecosystems, and challenges of this remote
          and captivating region.
        </p>
        <button
          className="captive-cta"
          onClick={() => {
            if (!allLoaded) return;
            setActiveIdx(0);
            setCycling(true);
          }}
          disabled={!allLoaded}
          aria-label="Jump into the story"
        >
          {allLoaded ? 'Explore The Story' : 'Loading…'}
        </button>
      </div>

      {/* Date label + progress dots — shown while cycling */}
      {/* {cycling && (
        <div style={{
          position:      'absolute',
          bottom:        52,
          left:          '50%',
          transform:     'translateX(-50%)',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           10,
          zIndex:        2,
          pointerEvents: 'none',
        }}>
          <span style={{
            color:         'rgba(255,255,255,0.75)',
            fontSize:      '0.8rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>
            {FRAMES[activeIdx]?.label}
          </span>
          <div style={{ display: 'flex', gap: 7 }}>
            {FRAMES.map((_, i) => (
              <div key={i} style={{
                width:        i === activeIdx ? 18 : 6,
                height:       6,
                borderRadius: 3,
                background:   i <= activeIdx ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                transition:   'all 400ms ease',
              }} />
            ))}
          </div>
        </div>
      )} */}

    </section>
  );
}
