import { trackEvent, trackStep } from '../tracker.js';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ScrollamaDemo from '../components/Scrollytelling.jsx';
import NewMap from '../components/Map.jsx';
import FrontPage from '../components/FrontPage.jsx';
import SvgPanel from '../components/Svg.jsx';
import IceExtentMap from '../components/IceExtentMap.jsx';
import PhotosynthesisPanel from '../components/Photosynthesis.jsx';
import ShippingRoutesPanel from '../components/ShippingRoutesPanel.jsx';
import Evaluation from '../components/Evaluation.jsx';
import TemperatureLineChart, { TempQuiz } from '../components/TemperatureLineChart.jsx';
import ChapterTimeline from '../components/ChapterTimeline.jsx';
import TextBubble from '../components/TextBubble.jsx';
import SeasonDisplay from '../components/SeasonDisplay.jsx';
import ErosionSlider from '../components/ErosionSlider.jsx';
import {
  STEPS, SEASONS, TIMELINE_H,
  ICE_EXTENT_URL, COG_START_YEAR, COG_END_YEAR,
  IMAGE_SEQUENCE_END, MAP_TRANSITION_START,
} from '../story-data.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const SVG_WHEEL_MIN_DELTA = 28;
const SVG_WHEEL_GESTURE_IDLE_MS = 50;
const SVG_TOUCH_THRESHOLD = 72;
const SVG_STEP_COOLDOWN_MS = 50;
const CONTROLLED_SVG_CHAPTERS = ['svg', 'photosynthesis'];
const SVG_CHAPTER_DISSOLVE_MS = 1900;
const SVG_CHAPTER_VEIL_HOLD_MS = 320;
const SVG_CHAPTER_WASH_OPACITY = 0.14;

// ── Component ─────────────────────────────────────────────────────────────────
export default function StoryScene() {
  const [viewPoint,  setViewPoint]  = useState(0);
  const [introProgress, setIntroProgress] = useState(0);
  const [iceYear,    setIceYear]    = useState(1979);
  const [scrollYear,     setScrollYear]     = useState(null);
  const [arcticRevealed, setArcticRevealed] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [anchorPos,      setAnchorPos]      = useState(null);
  const [photoAnchorPos, setPhotoAnchorPos] = useState(null);
  const [erosionProgress, setErosionProgress] = useState(0);
  const [introMapShrunk, setIntroMapShrunk] = useState(false);
  const [introHandoffPhase, setIntroHandoffPhase] = useState('idle');
  const [scrollLocked, setScrollLocked] = useState(false);
  const [chapterTransitioning, setChapterTransitioning] = useState(false);
  const viewPointRef = useRef(viewPoint);
  const controlledStepLockedRef = useRef(false);
  const controlledWheelGestureActiveRef = useRef(false);
  const controlledTouchGestureActiveRef = useRef(false);
  const controlledTouchStartYRef = useRef(null);
  const controlledScrollamaEntryLockedRef = useRef(false);
  const svgChapterDissolveTimersRef = useRef([]);
  const [retainedSvgLayerId, setRetainedSvgLayerId] = useState(null);
  const [retainedPhotoLayerId, setRetainedPhotoLayerId] = useState(null);
  const [retainedPhotoAnchorLayerId, setRetainedPhotoAnchorLayerId] = useState(null);
  const [svgChapterDissolve, setSvgChapterDissolve] = useState(null);

  const cogUrl = useCallback(year => `${import.meta.env.BASE_URL}tif_data/anom_${year}.tif`, []);

  const step = STEPS[viewPoint] ?? STEPS[0];
  useEffect(() => {
    viewPointRef.current = viewPoint;
  }, [viewPoint]);
  const mapRevealed = true;
  const landingFading = introProgress >= MAP_TRANSITION_START;
  const introFlyTriggered = landingFading;

  // Lock scroll during fly-out + clip animation so the user can't skip past them
  useEffect(() => {
    if (!landingFading || scrollLocked || introMapShrunk) return undefined;
    const frame = requestAnimationFrame(() => setScrollLocked(true));
    return () => cancelAnimationFrame(frame);
  }, [landingFading, scrollLocked, introMapShrunk]);

  useEffect(() => {
    if (!scrollLocked) return;
    const block = e => e.preventDefault();
    window.addEventListener('wheel',     block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('wheel',     block);
      window.removeEventListener('touchmove', block);
    };
  }, [scrollLocked]);
  const introMapOpacity = viewPoint === 0
    ? clamp01((introProgress - MAP_TRANSITION_START + 0.08) / 0.14)
    : 1;

  const navigateToChapter = (chapterId) => {
    const stepIndex = STEPS.findIndex(s => s.chapter === chapterId);
    if (stepIndex < 0) return;
    setChapterTransitioning(true);
    setTimeout(() => {
      // Force viewPoint immediately so chapter panels switch without waiting for Scrollama
      setViewPoint(stepIndex);
      const el = document.querySelector(`[data-step="${stepIndex}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Place element top at 45% from viewport top — above Scrollama's 0.60 offset trigger,
        // so the step registers as active when the user resumes scrolling.
        window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.45 });
      }
      setTimeout(() => setChapterTransitioning(false), 80);
    }, 320);
  };

  const scrollToStep = useCallback((stepIndex, offset = 0.60) => {
    const el = document.querySelector(`[data-step="${stepIndex}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * offset });
  }, []);

  const startSvgChapterDissolve = useCallback((from, to) => {
    svgChapterDissolveTimersRef.current.forEach(clearTimeout);
    svgChapterDissolveTimersRef.current = [];
    setSvgChapterDissolve({ from, to, phase: 'covering' });
    svgChapterDissolveTimersRef.current = [
      setTimeout(() => {
        setSvgChapterDissolve(current =>
          current?.from === from && current?.to === to
            ? { from, to, phase: 'revealing' }
            : current
        );
      }, SVG_CHAPTER_VEIL_HOLD_MS),
      setTimeout(() => {
        setSvgChapterDissolve(current =>
          current?.from === from && current?.to === to ? null : current
        );
      }, SVG_CHAPTER_DISSOLVE_MS),
    ];
  }, []);

  useEffect(() => () => {
    svgChapterDissolveTimersRef.current.forEach(clearTimeout);
  }, []);

  // Derive layout flags directly from the step's chapter — no magic offsets
  const inWideChapter    = step.chapter === 'seasons' || step.chapter === 'svg' || step.chapter === 'photosynthesis' || step.chapter === 'shipping' || step.chapter === 'polar';
  const inSvgChapter       = step.chapter === 'svg';
  const inPhotoChapter     = step.chapter === 'photosynthesis';
  const inControlledSvgChapter = CONTROLLED_SVG_CHAPTERS.includes(step.chapter);
  const inShippingChapter    = step.chapter === 'shipping';
  const inPolarChapter       = step.chapter === 'polar';
  const inEvaluationChapter  = step.chapter === 'evaluation';
  const inMapIntroStep     = step.chapter === 'intro' && !!step.camera;
  const mapIsFullScreen    = inMapIntroStep && !introMapShrunk;
  const introHandoffActive = introHandoffPhase === 'crossfading';
  const firstMapOverviewStep = step.chapter === 'map' && step.camera === 'world-overview';
  const introTemperatureOpacity = introMapShrunk && !!step.lineChartStep && introHandoffPhase !== 'preparing'
    ? 0.62
    : 0;
  const introCogFadeDuration = introHandoffActive || introHandoffPhase === 'settling' ? 1700 : 250;
  const showCinematicIntroMap = mapIsFullScreen || introHandoffActive;
  const twoColumnStarted = introMapShrunk || step.chapter !== 'intro';
  const retainedTwoColumnMapStep = useMemo(() => {
    for (let i = viewPoint; i >= 0; i -= 1) {
      const candidate = STEPS[i];
      if (candidate?.chapter === 'map' || candidate?.lineChartStep) return candidate;
    }
    return null;
  }, [viewPoint]);
  const showTwoColumnMap = !showCinematicIntroMap && !inEvaluationChapter && twoColumnStarted && !!retainedTwoColumnMapStep;
  const twoColumnMapCamera = retainedTwoColumnMapStep?.chapter === 'map'
    ? retainedTwoColumnMapStep.camera
    : 'world-overview';
  const mapCompletionOverlayImage = retainedTwoColumnMapStep?.chapter === 'map' && retainedTwoColumnMapStep.camera === 'svalbard'
    ? `${import.meta.env.BASE_URL}Images/2022-05-29.jpg`
    : null;

  // Season accordion active tab: clamped to last index once SVG chapter starts
  const seasonIndex = step.chapter === 'seasons' ? step.seasonIndex
                    : step.chapter === 'svg'     ? SEASONS.length - 1
                    : -1;

  const svgPanelLayerId = inSvgChapter ? step.layerId : retainedSvgLayerId;
  const photoPanelLayerId = inPhotoChapter ? step.layerId : retainedPhotoLayerId;
  const photoPanelAnchorLayerId = inPhotoChapter ? step.bubbleAnchorLayerId : retainedPhotoAnchorLayerId;

  const svgToPhotoDissolve = svgChapterDissolve?.from === 'svg' && svgChapterDissolve?.to === 'photosynthesis';
  const photoToSvgDissolve = svgChapterDissolve?.from === 'photosynthesis' && svgChapterDissolve?.to === 'svg';
  const svgChapterDissolveActive = Boolean(svgChapterDissolve);
  const svgPanelOpacity = inSvgChapter ? 1 : 0;
  const photoPanelOpacity = inPhotoChapter ? 1 : 0;
  const photoPanelActive = inPhotoChapter || photoToSvgDissolve;

  const controlledStepIndices = useMemo(
    () => STEPS.map((s, i) => CONTROLLED_SVG_CHAPTERS.includes(s.chapter) ? i : -1).filter(i => i >= 0),
    []
  );
  const controlledStartIndex = controlledStepIndices[0] ?? -1;
  const controlledEndIndex = controlledStepIndices[controlledStepIndices.length - 1] ?? -1;

  useEffect(() => {
    if (!inControlledSvgChapter || controlledStartIndex < 0 || controlledEndIndex < 0) return undefined;

    let unlockTimer = null;
    let wheelIdleTimer = null;

    const goToControlledStep = (direction) => {
      if (controlledStepLockedRef.current) return;
      const currentPosition = controlledStepIndices.indexOf(viewPointRef.current);
      if (currentPosition < 0) return;

      const nextIndex = direction > 0
        ? (currentPosition === controlledStepIndices.length - 1 ? controlledEndIndex + 1 : controlledStepIndices[currentPosition + 1])
        : (currentPosition === 0 ? controlledStartIndex - 1 : controlledStepIndices[currentPosition - 1]);

      if (nextIndex < 0 || nextIndex >= STEPS.length) return;

      controlledStepLockedRef.current = true;
      const currentChapter = STEPS[viewPointRef.current]?.chapter;
      const nextChapter = STEPS[nextIndex]?.chapter;
      if (
        currentChapter !== nextChapter &&
        CONTROLLED_SVG_CHAPTERS.includes(currentChapter) &&
        CONTROLLED_SVG_CHAPTERS.includes(nextChapter)
      ) {
        startSvgChapterDissolve(currentChapter, nextChapter);
      }
      if (nextChapter === 'svg') {
        setRetainedSvgLayerId(STEPS[nextIndex]?.layerId);
      } else if (nextChapter === 'photosynthesis') {
        setRetainedPhotoLayerId(STEPS[nextIndex]?.layerId);
        setRetainedPhotoAnchorLayerId(STEPS[nextIndex]?.bubbleAnchorLayerId);
      }
      viewPointRef.current = nextIndex;
      setViewPoint(nextIndex);
      trackStep(STEPS[nextIndex]?.chapter);
      scrollToStep(nextIndex);

      unlockTimer = setTimeout(() => {
        controlledStepLockedRef.current = false;
      }, SVG_STEP_COOLDOWN_MS);
    };

    const onWheel = (event) => {
      event.preventDefault();
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => {
        controlledWheelGestureActiveRef.current = false;
      }, SVG_WHEEL_GESTURE_IDLE_MS);

      if (Math.abs(event.deltaY) < SVG_WHEEL_MIN_DELTA) return;
      if (controlledWheelGestureActiveRef.current) return;
      controlledWheelGestureActiveRef.current = true;
      goToControlledStep(event.deltaY > 0 ? 1 : -1);
    };

    const onTouchStart = (event) => {
      controlledTouchGestureActiveRef.current = false;
      controlledTouchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event) => {
      const startY = controlledTouchStartYRef.current;
      if (startY == null) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;
      const delta = startY - currentY;
      if (Math.abs(delta) < SVG_TOUCH_THRESHOLD) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      if (controlledTouchGestureActiveRef.current) return;
      controlledTouchGestureActiveRef.current = true;
      controlledTouchStartYRef.current = currentY;
      goToControlledStep(delta > 0 ? 1 : -1);
    };

    const onTouchEnd = () => {
      controlledTouchGestureActiveRef.current = false;
      controlledTouchStartYRef.current = null;
    };

    const onKeyDown = (event) => {
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        goToControlledStep(1);
      } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        goToControlledStep(-1);
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
      controlledStepLockedRef.current = false;
      controlledWheelGestureActiveRef.current = false;
      controlledTouchGestureActiveRef.current = false;
      controlledTouchStartYRef.current = null;
      controlledScrollamaEntryLockedRef.current = false;
    };
  }, [controlledEndIndex, controlledStartIndex, controlledStepIndices, inControlledSvgChapter, scrollToStep, startSvgChapterDissolve]);

  // Steps with a title or figure use the structured card layout (left-aligned);
  // plain intro/map steps render as centred text.
  const textInput = STEPS.map(s => {
    const figure = s.layerId === 'Sea_ice_early'
      ? <IceExtentMap getUrl={ICE_EXTENT_URL} onYearChange={setIceYear} />
      : s.lineChartStep === 'quiz'
        ? <TempQuiz onCorrectAnswer={() => { setArcticRevealed(true); trackEvent('quiz_correct'); }} onAnswer={answer => { setShowAllRegions(true); trackEvent('quiz_answer', { answer }); }} />
        : s.isErosionSlider
          ? <ErosionSlider onChange={setErosionProgress} />
          : s.figure;
    return (s.title !== undefined || figure || s.image)
      ? { title: s.title, body: s.text, figure, image: s.image }
      : s.text;
  });

  const glacierCameraKey   = step.glacierCamera ?? STEPS[viewPoint + 1]?.glacierCamera ?? null;
  const glacierStepIndices = STEPS.map((s, i) => s.glacierCamera ? i : -1).filter(i => i >= 0);
  const stickyStartIndex   = glacierStepIndices[0]  ?? -1;
  const stickyEndIndex     = glacierStepIndices[glacierStepIndices.length - 1] ?? -1;

  const lineChartStepIndices = STEPS.map((s, i) => s.lineChartStep ? i : -1).filter(i => i >= 0);
  const sticky2StartIndex    = lineChartStepIndices[0]  ?? -1;
  const sticky2EndIndex      = lineChartStepIndices[lineChartStepIndices.length - 1] ?? -1;
  const lineChartStep        = step.lineChartStep ?? STEPS[viewPoint + 1]?.lineChartStep ?? null;

  const leftClass = `scrolly-left ${twoColumnStarted ? 'show' : ''}`;

  // Map a layer ID to a figure component for that bubble.
  const bubbleFigure = step.layerId === 'Sea_ice_early'
    ? <IceExtentMap getUrl={ICE_EXTENT_URL} onYearChange={setIceYear} />
    : step.isErosionSlider
      ? <ErosionSlider onChange={setErosionProgress} />
      : null;

  const effectiveAnchorPos = inSvgChapter ? anchorPos : inPhotoChapter ? photoAnchorPos : null;
  const bubbleConfig = !effectiveAnchorPos || !step.bubble ? null
    : Array.isArray(step.bubble) ? step.bubble[0]
    : step.bubble;
  const bubbleImage = step.image
    ? (typeof step.image === 'string'
        ? { image: step.image }
        : { image: step.image.src, alt: step.image.alt, caption: step.image.caption })
    : null;
  const bubbleText = bubbleConfig?.text
    ?? (bubbleImage && bubbleConfig?.imageSide
        ? [{ image: bubbleImage.image, alt: bubbleImage.alt, caption: bubbleImage.caption, text: step.text }]
        : bubbleImage
          ? [step.text, bubbleImage].filter(Boolean)
          : step.text);
  const bubbles = bubbleConfig ? [{
    title:  bubbleConfig.title ?? step.title,
    text:   bubbleText,
    arrow:  bubbleConfig.arrow,
    figure: bubbleFigure,
    width:  bubbleConfig?.width ?? (step.layerId === 'Sea_ice_early' ? 480 : step.isErosionSlider ? 460 : undefined),
    cta:    bubbleConfig.cta ?? null,
    x:      effectiveAnchorPos.x,
    y:      effectiveAnchorPos.y,
  }] : [];

  return (
    <>
    {createPortal(
      <>
        {viewPoint === 0 && (
          <FrontPage
            progress={introProgress}
            fading={landingFading}
            imageSequenceEnd={IMAGE_SEQUENCE_END}
          />
        )}

        {/* Cinematic intro map: full-screen only for the Svalbard fly-out, then
            fades away while the normal two-column layout fades in underneath. */}
        {showCinematicIntroMap && (() => {
          return (
            <div style={{
              position:     'fixed',
              inset:        0,
              overflow:     'hidden',
              zIndex:       4,
              background:   '#07111c',
              opacity:      introHandoffActive ? 0 : introMapOpacity,
              transition:   introHandoffActive ? 'opacity 1400ms ease' : 'opacity 950ms ease-out',
              pointerEvents: 'none',
            }}>
              <NewMap
                cameraKey="intro-arctic"
                hideGlobeToggle
                embed
                initialViewState={{ longitude: 16.57969, latitude: 77.82355, zoom: 9.508 }}
                mapRevealed={mapRevealed}
                introFlyTriggered={introFlyTriggered}
                onFlyOutComplete={() => {
                  setIntroMapShrunk(true);
                  setViewPoint(1);
                  setIntroHandoffPhase('crossfading');

                  requestAnimationFrame(() => {
                    const el = document.querySelector('[data-step="1"]');
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.60 });
                    }
                  });

                  setTimeout(() => {
                    setIntroHandoffPhase('settling');
                    setScrollLocked(false);
                    setTimeout(() => setIntroHandoffPhase('settled'), 650);
                  }, 1400);
                }}
              />
            </div>
          );
        })()}

        {/* Full-screen SVG overlay — circle-reveals in when svg chapter starts */}
        <div style={{
          position:      'fixed',
          top:           0,
          left:          0,
          right:         0,
          bottom:        TIMELINE_H,
          zIndex:        svgToPhotoDissolve ? 7 : 5,
          opacity:       svgPanelOpacity,
          transition:    svgChapterDissolveActive
            ? `opacity ${SVG_CHAPTER_DISSOLVE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : 'opacity 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: inSvgChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <SvgPanel
            src={`${import.meta.env.BASE_URL}SVG/Late_summer.svg`}
            activeLayerId={svgPanelLayerId}
            iceYear={iceYear}
            erosionProgress={erosionProgress}
            onAnchorPosition={setAnchorPos}
          />
        </div>

        {/* Full-screen Photosynthesis overlay */}
        <div style={{
          position:      'fixed',
          top:           0,
          left:          0,
          right:         0,
          bottom:        TIMELINE_H,
          zIndex:        photoToSvgDissolve ? 7 : 6,
          opacity:       photoPanelOpacity,
          transition:    svgChapterDissolveActive
            ? `opacity ${SVG_CHAPTER_DISSOLVE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : 'opacity 1300ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: inPhotoChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <PhotosynthesisPanel activeLayerId={photoPanelLayerId} anchorLayerId={photoPanelAnchorLayerId} active={photoPanelActive} erosionProgress={erosionProgress} onAnchorPosition={setPhotoAnchorPos} />
        </div>

        {/* Light wash during the SVG chapter crossfade */}
        <div style={{
          position:      'fixed',
          top:           0,
          left:          0,
          right:         0,
          bottom:        TIMELINE_H,
          zIndex:        21,
          opacity:       svgChapterDissolve
            ? (svgChapterDissolve.phase === 'covering' ? SVG_CHAPTER_WASH_OPACITY : 0)
            : 0,
          transition:    svgChapterDissolve?.phase === 'covering'
            ? `opacity ${SVG_CHAPTER_VEIL_HOLD_MS}ms ease-out`
            : `opacity ${SVG_CHAPTER_DISSOLVE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          pointerEvents: 'none',
          background:    'white',
        }} />

        {/* Full-screen Evaluation overlay — covers entire screen including chapter bar */}
        <div style={{
          position:      'fixed', top: 0, left: 0, right: 0, bottom: 0,
          height:        '100vh', width: '100vw',
          zIndex:        300,
          opacity:       inEvaluationChapter ? 1 : 0,
          transition:    'opacity 600ms ease',
          pointerEvents: inEvaluationChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <Evaluation />
        </div>

        {/* Text bubbles on top of the overlay */}
        {bubbles.map((b, i) => (
          <TextBubble
            key={`${viewPoint}-${i}`}
            title={b.title}
            text={b.text}
            x={b.x}
            y={b.y}
            arrow={b.arrow}
            figure={b.figure}
            width={b.width}
            cta={b.cta}
            onCta={b.cta ? () => navigateToChapter('evaluation') : undefined}
          />
        ))}

        <div style={{ opacity: !inMapIntroStep ? 1 : 0, transition: 'opacity 900ms ease', pointerEvents: !inMapIntroStep ? 'auto' : 'none' }}>
          <ChapterTimeline currentChapter={step.chapter} onNavigate={navigateToChapter} />
        </div>

        {/* Chapter-jump fade overlay — prevents seeing scroll fly through intermediate steps */}
        <div style={{
          position:      'fixed', inset: 0,
          background:    'white',
          zIndex:        500,
          opacity:       chapterTransitioning ? 1 : 0,
          transition:    chapterTransitioning ? 'opacity 300ms ease' : 'opacity 450ms ease',
          pointerEvents: chapterTransitioning ? 'auto' : 'none',
        }} />
      </>,
      document.body
    )}
    {mapRevealed && <div
      className={`scrolly-layout ${(twoColumnStarted && !showCinematicIntroMap) ? '' : 'is-intro'}`}
      style={{
        ...(!twoColumnStarted || showCinematicIntroMap ? { position: 'relative', zIndex: 1 } : undefined),
        opacity:       (inSvgChapter || inPhotoChapter || inEvaluationChapter) ? 0 : 1,
        transition:    'opacity 2000ms ease',
        pointerEvents: (inSvgChapter || inPhotoChapter || inEvaluationChapter) ? 'none' : 'auto',
      }}
    >
      <aside className={leftClass}>

        {/* Map — fades out when wide chapter starts */}
        <div
          className="left-top"
          style={{
            opacity:       inWideChapter ? 0 : 1,
            transition:    'opacity 1200ms ease',
            pointerEvents: inWideChapter ? 'none' : 'auto',
          }}
        >
          {showTwoColumnMap && (
            <NewMap
              cameraKey={twoColumnMapCamera}
              quizMode={retainedTwoColumnMapStep?.quiz === true}
              bathymetryMode={retainedTwoColumnMapStep?.bathymetryMode}
              completionOverlayImage={mapCompletionOverlayImage}
              hideGlobeToggle={!firstMapOverviewStep}
              cogUrl={cogUrl}
              cogYear={scrollYear ?? COG_START_YEAR}
              cogOpacity={introTemperatureOpacity}
              cogFadeDuration={introCogFadeDuration}
              useLightStyle={introMapShrunk || step.chapter === 'map'}
            />
          )}
        </div>

        {/* Wide chapter panel — fades in after map has finished fading out */}
        <div style={{
          position:      'absolute', inset: 0,
          borderRadius:  12, overflow: 'hidden',
          opacity:       inWideChapter ? 1 : 0,
          transition:    inWideChapter
            ? 'opacity 900ms ease 750ms'
            : 'opacity 400ms ease',
          pointerEvents: inWideChapter ? 'auto' : 'none',
          background:    'white',
        }}>

          {/* Season display — hidden once SVG or Photosynthesis full-screen portal takes over */}
          <div style={{
            position:      'absolute', inset: 0,
            opacity:       (inSvgChapter || inPhotoChapter || inShippingChapter || inPolarChapter) ? 0 : 1,
            transition:    'opacity 800ms ease',
            pointerEvents: (inSvgChapter || inPhotoChapter || inShippingChapter || inPolarChapter) ? 'none' : 'auto',
          }}>
            <SeasonDisplay activeIndex={seasonIndex} />
          </div>

          {/* Shipping routes — ending chapter */}
          <div style={{
            position:   'absolute', inset: 0,
            opacity:    inShippingChapter ? 1 : 0,
            transition: 'opacity 1200ms ease',
          }}>
            <ShippingRoutesPanel
              active={inShippingChapter}
              stepIndex={step.chapter === 'shipping' ? step.stepIndex : -1}
            />
          </div>

          {/* Arctic polar map — Mapbox globe view */}
          <div style={{
            position:   'absolute', inset: 0,
            opacity:    inPolarChapter ? 1 : 0,
            transition: 'opacity 1200ms ease',
          }}>
            <NewMap cameraKey={inPolarChapter ? step.camera : undefined} embed />
          </div>

        </div>
      </aside>

      <main className="scrolly-right">
        <ScrollamaDemo
          handleUpdate={({ viewPoint: vp }) => {
            const nextChapter = STEPS[vp]?.chapter;
            const nextIsControlledSvgStep = CONTROLLED_SVG_CHAPTERS.includes(nextChapter);
            if (nextIsControlledSvgStep && (inControlledSvgChapter || controlledScrollamaEntryLockedRef.current)) return;
            if (nextIsControlledSvgStep) {
              controlledScrollamaEntryLockedRef.current = true;
              controlledStepLockedRef.current = true;
              if (nextChapter === 'svg') {
                setRetainedSvgLayerId(STEPS[vp]?.layerId);
              } else if (nextChapter === 'photosynthesis') {
                setRetainedPhotoLayerId(STEPS[vp]?.layerId);
                setRetainedPhotoAnchorLayerId(STEPS[vp]?.bubbleAnchorLayerId);
              }
              requestAnimationFrame(() => scrollToStep(vp));
              setTimeout(() => {
                controlledStepLockedRef.current = false;
              }, SVG_STEP_COOLDOWN_MS);
            }
            viewPointRef.current = vp;
            setViewPoint(vp);
            trackStep(nextChapter);
          }}
          onProgress={({ step: progressStep, progress }) => {
            if (progressStep === 0) {
              setIntroProgress(progress);
            }
          }}
          textInput={textInput}
          stickyStartIndex={stickyStartIndex}
          stickyEndIndex={stickyEndIndex}
          stickyContent={glacierCameraKey
            ? <div style={{ height: '450px', borderRadius: 8, overflow: 'hidden' }}><NewMap cameraKey={glacierCameraKey} quizMode={false} embed /></div>
            : null}
          sticky2StartIndex={sticky2StartIndex}
          sticky2EndIndex={sticky2EndIndex}
          sticky2Content={mapRevealed && lineChartStep && introMapShrunk
            ? <div style={{ animation: 'slowFadeIn 2500ms ease forwards' }}>
                <TemperatureLineChart step={lineChartStep} currentYear={scrollYear ?? COG_START_YEAR} startYear={COG_START_YEAR} endYear={COG_END_YEAR} onYearSelect={y => setScrollYear(y)} arcticRevealed={arcticRevealed} showAllRegions={showAllRegions} />
              </div>
            : null}
        />
      </main>
    </div>}
    </>
  );
}
