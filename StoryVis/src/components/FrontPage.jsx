import { useState } from 'react';

const BASE = import.meta.env.BASE_URL;

const FRAMES = [
  { src: `${BASE}Images/2022-05-29.jpg`, label: 'May 29'  },
  { src: `${BASE}Images/2022-06-03.jpg`, label: 'June 2'  },
  { src: `${BASE}Images/2022-06-02.jpg`, label: 'June 3'  },
  { src: `${BASE}Images/2022-06-22.jpg`, label: 'June 22' },
  { src: `${BASE}Images/2022-07-07.jpg`, label: 'July 7' },

];

const FRAME_TEXTS = [
  '',
  'Every spring, the Arctic sea breaks up',
  'Every summer, the sea ice retreats from the Arctic coast',
  'Every decade, less sea ice remains in the Arctic Ocean',
  'How does life on seafloor adapt to a changing Arctic Ocean?',
];

const EXIT_FADE_MS = 1000;
const IMAGE_CROSSFADE_MS = 900;
const DEFAULT_IMAGE_SEQUENCE_END = 0.90;

const clamp01 = value => Math.max(0, Math.min(1, value));

export default function FrontPage({ progress = 0, fading, imageSequenceEnd = DEFAULT_IMAGE_SEQUENCE_END }) {
  const [loadedCount, setLoadedCount] = useState(0);

  const allLoaded = loadedCount >= FRAMES.length;
  const imageProgress = clamp01(progress / imageSequenceEnd);
  const activeIdx = Math.min(FRAMES.length - 1, Math.floor(imageProgress * FRAMES.length));
  const hasScrolled = progress > 0.1;
  const settledTextIdx = hasScrolled && !fading ? activeIdx : -1;

  return (
    <section
      className={`hero${fading ? ' is-fading' : ''}`}
    >

      {/* Image stack — crossfades as scroll advances activeIdx */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#07111c' }}>
        {FRAMES.map(({ src }, i) => {
          return (
            <img
              key={src}
              src={src}
              alt=""
              onLoad={() => setLoadedCount(n => n + 1)}
              style={{
                position:      'absolute',
                inset:         0,
                width:         '100vw',
                height:        '100vh',
                objectFit:     'cover',
                objectPosition:'center',
                opacity:       fading ? 0 : i === activeIdx ? 1 : 0,
                zIndex:        i === activeIdx ? 1 : 0,
                transition:    `opacity ${fading ? EXIT_FADE_MS : IMAGE_CROSSFADE_MS}ms ease-in-out`,
                pointerEvents: 'none',
                userSelect:    'none',
                willChange:    'opacity',
              }}
            />
          );
        })}
      </div>

      {/* Title + subtitle — fades out on first scroll */}
      <div style={{
        position:       'relative',
        zIndex:         2,
        width:          '100%',
        height:         '100%',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        alignItems:     'center',
        opacity:        hasScrolled ? 0 : 1,
        transition:     'opacity 800ms ease',
        pointerEvents:  hasScrolled ? 'none' : 'auto',
      }}>
        <h1 style={{ fontSize: '5em', marginBottom: '40px' }}>
          A Changing Arctic Ocean
        </h1>
        <p style={{ fontSize: '2em', textAlign: 'center', maxWidth: '700px' }}>
          Explore the Arctic Ocean through our interactive storytelling visualization.
          Dive into the unique features, ecosystems, and challenges of this remote
          and captivating region.
        </p>
      </div>

      {/* Scroll indicator — bottom-center, fades out on first scroll */}
      <div style={{
        position:      'absolute',
        bottom:        '5vh',
        left:          '50%',
        transform:     'translateX(-50%)',
        zIndex:        3,
        opacity:       hasScrolled ? 0 : allLoaded ? 1 : 0.4,
        transition:    'opacity 800ms ease',
        pointerEvents: hasScrolled ? 'none' : 'auto',
      }}>
        <div className="scroll-indicator">
          <span className="scroll-indicator-label">
            {allLoaded ? 'Scroll to explore the story' : 'Loading...'}
          </span>
          <div className="scroll-chevron">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Narrative overlay — one settled line per fully visible image */}
      <div style={{
        position:      'absolute',
        inset:         0,
        zIndex:        2,
        display:       'flex',
        alignItems:    'flex-start',
        justifyContent:'flex-start',
        gap:           20,
        pointerEvents: 'none',
        padding:       '8vh 6vw 0',
      }}>
        {FRAME_TEXTS.map((text, i) => text && (
          <p
            key={text}
            style={{
              position:      'absolute',
              margin:        0,
              fontSize:      '4em',
              fontWeight:    600,
              color:         'rgba(0, 0, 0, 0.96)',
              lineHeight:    1.12,
              maxWidth:      '980px',
              textAlign:     'left',
              textShadow:    'none',
              opacity:       settledTextIdx === i ? 1 : 0,
              transition:    'opacity 750ms ease',
            }}
          >
            {text}
          </p>
        ))}
      </div>

    </section>
  );
}
