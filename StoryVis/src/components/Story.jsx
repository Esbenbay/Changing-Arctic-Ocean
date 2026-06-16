import { trackEvent, trackStep } from '../tracker.js';
import { useState, useCallback, useEffect } from 'react';
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
  const [isClipTransitioning, setIsClipTransitioning] = useState(false);
  const [isClipAnimating, setIsClipAnimating] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [chapterTransitioning, setChapterTransitioning] = useState(false);

  const cogUrl = useCallback(year => `${import.meta.env.BASE_URL}tif_data/anom_${year}.tif`, []);

  const step = STEPS[viewPoint] ?? STEPS[0];
  const mapRevealed = true;
  const landingFading = introProgress >= MAP_TRANSITION_START;
  const introFlyTriggered = landingFading;

  // Lock scroll during fly-out + clip animation so the user can't skip past them
  useEffect(() => {
    if (landingFading && !scrollLocked && !introMapShrunk) setScrollLocked(true);
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

  // Derive layout flags directly from the step's chapter — no magic offsets
  const sceneStarted    = step.chapter !== 'intro';
  const inWideChapter    = step.chapter === 'seasons' || step.chapter === 'svg' || step.chapter === 'photosynthesis' || step.chapter === 'shipping' || step.chapter === 'polar';
  const inSvgChapter       = step.chapter === 'svg';
  const inPhotoChapter     = step.chapter === 'photosynthesis';
  const inShippingChapter    = step.chapter === 'shipping';
  const inPolarChapter       = step.chapter === 'polar';
  const inEvaluationChapter  = step.chapter === 'evaluation';
  const inMapIntroStep     = step.chapter === 'intro' && !!step.camera;
  const mapIsFullScreen    = inMapIntroStep && !introMapShrunk;
  const showIntroMap       = (step.chapter === 'intro' && (inMapIntroStep || introMapShrunk || !!step.lineChartStep)) || step.chapter === 'map';
  // Season accordion active tab: clamped to last index once SVG chapter starts
  const seasonIndex = step.chapter === 'seasons' ? step.seasonIndex
                    : step.chapter === 'svg'     ? SEASONS.length - 1
                    : -1;

  const activeLayerId = step.chapter === 'svg' ? step.layerId : null;

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

  const leftClass = `scrolly-left ${sceneStarted ? 'show' : ''}`;

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

        {/* Intro map — full-screen on step 0, left-panel with temperature layer on lineChart steps.
            Transition uses clip-path instead of width/height/top/left so Mapbox never resizes
            its canvas mid-animation (no tile re-render = no jank). Once the clip animation
            finishes the container silently resizes to the real panel dimensions. */}
        {showIntroMap && (() => {
          // During the clip transition keep the container at 100vw×100vh and animate
          // clip-path. After the timeout the container snaps to panel size (invisible
          // because the clip already shows exactly that area).
          const useFullScreen = mapIsFullScreen || isClipTransitioning || isClipAnimating;

          // right inset = 100vw - page-pad - panel-width
          // panel-width = (100vw - 2*18px)*0.6 - 1vh  →  40vw + 3.6px + 1vh
          const CLIP_FULL  = 'inset(0px 0px 0px 0px round 0px)';
          const CLIP_PANEL = 'inset(5vh calc(40vw + 3.6px + 1vh) 5vh 18px round 12px)';

          return (
            <div style={{
              position:     'fixed',
              top:          useFullScreen ? 0 : '5vh',
              left:         useFullScreen ? 0 : 'var(--page-pad)',
              width:        useFullScreen ? '100vw' : 'calc((100vw - 2 * var(--page-pad)) * 0.60 - var(--col-gap) / 2)',
              height:       useFullScreen ? '100vh' : '90vh',
              borderRadius: useFullScreen ? 0 : 12,
              overflow:     'hidden',
              zIndex:       4,
              background:   '#07111c',
              opacity:      introMapOpacity,
              clipPath:     mapIsFullScreen ? CLIP_FULL : isClipAnimating ? CLIP_PANEL : isClipTransitioning ? CLIP_FULL : 'none',
              transition:   isClipTransitioning
                ? 'clip-path 1600ms cubic-bezier(0.4,0,0.2,1), opacity 950ms ease-out'
                : 'opacity 950ms ease-out',
              pointerEvents: (!useFullScreen && showIntroMap && mapRevealed) ? 'auto' : 'none',
            }}>
              <NewMap
                cameraKey={
                  mapIsFullScreen                       ? step.camera
                  : (isClipTransitioning || isClipAnimating) ? 'intro-arctic'  // freeze camera during clip
                  : step.chapter === 'map'              ? step.camera
                  : showIntroMap                        ? 'global-temp'
                  : undefined
                }
                hideGlobeToggle={step.chapter !== 'map'}
                embed={step.chapter !== 'map'}
                initialViewState={{ longitude: 16.57969, latitude: 77.82355, zoom: 9.508 }}
                mapRevealed={mapRevealed}
                introFlyTriggered={introFlyTriggered}
                onFlyOutComplete={() => {
                  // 1. Switch to light style (satellite kept during the 9 s fly).
                  //    style.load fires setStyleLoaded(true) as soon as style JSON is ready
                  //    (~300-500 ms), so COG colors appear during the clip animation.
                  setIntroMapShrunk(true);
                  // 2. Enable clip-path transition while container is still at CLIP_FULL.
                  setIsClipTransitioning(true);
                  setTimeout(() => {
                    // 3. One frame later: change clip-path to CLIP_PANEL → CSS animates it.
                    setIsClipAnimating(true);
                    setTimeout(() => {
                      // 4. Clip done → snap container to real panel size, then
                      //    scroll so step 1 enters the Scrollama trigger zone (60 % from top).
                      //    This fires viewPoint=1 and shows the text card below the chart.
                      setIsClipTransitioning(false);
                      setIsClipAnimating(false);
                      setScrollLocked(false);
                      const el = document.querySelector('[data-step="1"]');
                      if (el) {
                        const rect = el.getBoundingClientRect();
                        const scrollTarget = window.scrollY + rect.top - window.innerHeight * 0.60;
                        window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                      }
                    }, 1700);
                  }, 50);
                }}
                cogUrl={cogUrl}
                cogYear={scrollYear ?? COG_START_YEAR}
                cogOpacity={!!step.lineChartStep && viewPoint >= 1 ? 0.62 : 0}
                useLightStyle={step.chapter === 'map' || introMapShrunk}
                quizMode={step.quiz === true}
              />
            </div>
          );
        })()}

        {/* Full-screen SVG overlay — circle-reveals in when svg chapter starts */}
        <div style={{
          position:      'fixed', top: 0, left: 0, right: 0, bottom: TIMELINE_H, zIndex: 5,
          opacity:       inSvgChapter ? 1 : 0,
          transition:    'opacity 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: inSvgChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <SvgPanel
            src={`${import.meta.env.BASE_URL}SVG/Late_summer.svg`}
            activeLayerId={activeLayerId}
            iceYear={iceYear}
            erosionProgress={erosionProgress}
            onAnchorPosition={setAnchorPos}
          />
        </div>

        {/* Full-screen Photosynthesis overlay */}
        <div style={{
          position:      'fixed', top: 0, left: 0, right: 0, bottom: TIMELINE_H, zIndex: 5,
          opacity:       inPhotoChapter ? 1 : 0,
          transition:    'opacity 900ms ease',
          pointerEvents: inPhotoChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <PhotosynthesisPanel activeLayerId={inPhotoChapter ? step.layerId : undefined} anchorLayerId={inPhotoChapter ? step.bubbleAnchorLayerId : undefined} active={inPhotoChapter} erosionProgress={erosionProgress} onAnchorPosition={setPhotoAnchorPos} />
        </div>

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
      className={`scrolly-layout ${(sceneStarted && !showIntroMap) ? '' : 'is-intro'}`}
      style={{
        ...(!sceneStarted || showIntroMap ? { position: 'relative', zIndex: 1 } : undefined),
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
          {!mapIsFullScreen && !showIntroMap && (
            <NewMap
              cameraKey={step.chapter === 'map' ? step.camera : undefined}
              quizMode={step.quiz === true}
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
            setViewPoint(vp);
            trackStep(STEPS[vp]?.chapter);
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
