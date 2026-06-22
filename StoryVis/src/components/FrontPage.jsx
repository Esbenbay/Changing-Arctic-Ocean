import { useState, useCallback, useEffect, useRef } from 'react';
import { FRONT_FRAMES } from '../story-assets.js';

const FRAMES = FRONT_FRAMES;

const FRAME_TEXTS = [
  '',
  'Every spring, the Arctic sea breaks up',
  'Every summer, the sea ice retreats from the Arctic coast',
  'Every decade, less sea ice remains in the Arctic Ocean',
  'How does life on seafloor adapt to a changing Arctic Ocean?',
];

const EXIT_FADE_MS = 1000;
const IMAGE_CROSSFADE_MS = 900;

const IMAGE_SEQUENCE_END = 0.90;
const FRONT_WHEEL_MIN_DELTA = 28;
const FRONT_WHEEL_GESTURE_IDLE_MS = 100                                                ;
const FRONT_TOUCH_THRESHOLD = 72;
const FRONT_STEP_COOLDOWN_MS = 100;

const idxFromProgress = (p, sequenceEnd = IMAGE_SEQUENCE_END) =>
  Math.min(FRAMES.length - 1, Math.floor(Math.min(1, p / sequenceEnd) * FRAMES.length));

const progressForFrame = (index, sequenceEnd = IMAGE_SEQUENCE_END) => {
  if (index <= 0) return 0;
  return Math.min(sequenceEnd - 0.02, (index / FRAMES.length) * sequenceEnd + 0.025);
};

const evaluationIsActive = () => document.body?.dataset.storyEvaluationActive === 'true';

export default function FrontPage({ progress = 0, fading, imageSequenceEnd = IMAGE_SEQUENCE_END }) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [activeIdx, setActiveIdx] = useState(() => idxFromProgress(progress, imageSequenceEnd));
  const stepLockedRef = useRef(false);
  const wheelGestureActiveRef = useRef(false);
  const touchGestureActiveRef = useRef(false);
  const touchStartYRef = useRef(null);
  const activeIdxRef = useRef(activeIdx);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  useEffect(() => {
    if (fading) return undefined;
    const frame = requestAnimationFrame(() => {
      const syncedIndex = idxFromProgress(progress, imageSequenceEnd);
      activeIdxRef.current = syncedIndex;
      setActiveIdx(syncedIndex);
    });
    return () => cancelAnimationFrame(frame);
  }, [fading, imageSequenceEnd, progress]);

  const scrollIntroToProgress = useCallback((targetProgress) => {
    const introStep = document.querySelector('[data-step="0"]');
    if (!introStep) return;
    const rect = introStep.getBoundingClientRect();
    const stepTop = window.scrollY + rect.top;
    window.scrollTo({ top: stepTop + introStep.offsetHeight * targetProgress });
  }, []);

  useEffect(() => {
    if (fading) return undefined;

    let unlockTimer = null;
    let wheelIdleTimer = null;

    const goToFrame = (direction) => {
      if (stepLockedRef.current) return;

      const currentIndex = activeIdxRef.current;
      const nextIndex = Math.max(0, Math.min(FRAMES.length - 1, currentIndex + direction));
      const leavingIntro = direction > 0 && currentIndex >= FRAMES.length - 1;

      stepLockedRef.current = true;

      if (leavingIntro) {
        scrollIntroToProgress(imageSequenceEnd + 0.02);
      } else {
        activeIdxRef.current = nextIndex;
        setActiveIdx(nextIndex);
        scrollIntroToProgress(progressForFrame(nextIndex, imageSequenceEnd));
      }

      unlockTimer = setTimeout(() => {
        stepLockedRef.current = false;
      }, FRONT_STEP_COOLDOWN_MS);
    };

    const onWheel = (event) => {
      if (evaluationIsActive()) return;
      event.preventDefault();
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => {
        wheelGestureActiveRef.current = false;
      }, FRONT_WHEEL_GESTURE_IDLE_MS);

      if (Math.abs(event.deltaY) < FRONT_WHEEL_MIN_DELTA) return;
      if (wheelGestureActiveRef.current) return;
      wheelGestureActiveRef.current = true;
      goToFrame(event.deltaY > 0 ? 1 : -1);
    };

    const onTouchStart = (event) => {
      if (evaluationIsActive()) return;
      touchGestureActiveRef.current = false;
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event) => {
      if (evaluationIsActive()) return;
      const startY = touchStartYRef.current;
      if (startY == null) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;
      const delta = startY - currentY;
      event.preventDefault();
      if (Math.abs(delta) < FRONT_TOUCH_THRESHOLD) return;
      if (touchGestureActiveRef.current) return;
      touchGestureActiveRef.current = true;
      touchStartYRef.current = currentY;
      goToFrame(delta > 0 ? 1 : -1);
    };

    const onTouchEnd = () => {
      if (evaluationIsActive()) return;
      touchGestureActiveRef.current = false;
      touchStartYRef.current = null;
    };

    const onKeyDown = (event) => {
      if (evaluationIsActive()) return;
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        goToFrame(1);
      } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        goToFrame(-1);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true });
    window.addEventListener('touchcancel', onTouchEnd, { capture: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      clearTimeout(unlockTimer);
      clearTimeout(wheelIdleTimer);
      stepLockedRef.current = false;
      wheelGestureActiveRef.current = false;
      touchGestureActiveRef.current = false;
      touchStartYRef.current = null;
    };
  }, [fading, imageSequenceEnd, scrollIntroToProgress]);

  const allLoaded = loadedCount >= FRAMES.length;
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
        <h1 className="front-hero-title">
          A Changing Arctic Ocean
        </h1>
        <p className="story-body-text front-hero-subtitle" style={{ margin: 0 }}>
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
            <svg viewBox="0 0 24 24" width="52" height="52" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            className="story-body-text front-frame-text"
            style={{
              position:      'absolute',
              margin:        0,
              fontWeight:    600,
              color:         'rgba(12, 25, 38, 0.96)',
              maxWidth:      '980px',
              textAlign:     'left',
              textShadow:    '0 1px 14px rgba(255,255,255,0.72)',
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
