import { trackStepEnter } from '../tracker.js';
import { useState, useEffect, useRef } from 'react';
import ScrollamaDemo from '../components/Scrollytelling.jsx';
import NewMap from '../components/Map.jsx';
import ScatterPlot from '../components/Barchart.jsx';
import SvgPanel from '../components/Svg.jsx';
import IceExtentMap from '../components/IceExtentMap.jsx';
import PhotosynthesisPanel from '../components/Photosynthesis.jsx';
import ShippingRoutesPanel from '../components/ShippingRoutesPanel.jsx';
import CogTemperatureMap from '../components/CogTemperatureMap.jsx';
import TemperatureLineChart, { TempQuiz } from '../components/TemperatureLineChart.jsx';

// ── Auto-sizing chart wrapper ─────────────────────────────────────────────────
function AutoChart({ Chart, height = 400 }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(300);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} style={{ width: '95%' }}><Chart parentWidth={width} parentHeight={height} /></div>;
}

const BASE = import.meta.env.BASE_URL;

// ── Season SVG sources ────────────────────────────────────────────────────────
const SEASONS = [
  { label: 'Arctic Night', src: `${BASE}SVG/Arctic_night.svg` },
  { label: 'Early Spring', src: `${BASE}SVG/Early_spring.svg` },
  { label: 'Late Spring',  src: `${BASE}SVG/Late_spring.svg`  },
  { label: 'Early Summer', src: `${BASE}SVG/Early_Summer.svg` },
  { label: 'Late Summer',  src: `${BASE}SVG/Late_summer.svg`  },
];

// ── Full-bleed season display with cross-fade transition ──────────────────────
function SeasonDisplay({ activeIndex }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'white' }}>
      {SEASONS.map((season, i) => (
        <img
          key={season.src}
          src={season.src}
          alt={season.label}
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'contain',
            opacity:    i === activeIndex ? 1 : 0,
            transition: 'opacity 1400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  );
}

// ── Master step config ────────────────────────────────────────────────────────
//
// Every scroll step lives here. `chapter` controls layout and which panel is
// shown; the remaining keys supply that step's content.
//
//   chapter: 'intro'    full-width right panel, map not visible
//            'map'      split layout with Mapbox map
//            'seasons'  split layout; map replaced by season accordion
//            'svg'      split layout; seasons replaced by SVG infographic
//
//   map steps     → camera (key from CAMERAS in Map.jsx), quiz (boolean)
//   season steps  → seasonIndex
//   svg steps     → layerId (string | null), figure (JSX, optional)
//   all steps     → text (required), title (optional)

const STEPS = [

  // ── Intro (no map panel) ──────────────────────────────────────────────────
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'Climate Change - increasing temperatures',
    text:          'Since the 1880s, burning fossil fuels has slowly released CO₂ into the atmosphere — warming the planet gradually at first, almost imperceptibly.',
  },
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          'Global average temperatures have now risen over 1°C since pre-industrial times — driving more frequent heatwaves, storms, and rising seas worldwide.',
  },
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'Global consequences',
    text:          'The impacts of this warming are far-reaching: melting glaciers, shifting ecosystems, and communities around the world facing unprecedented challenges.',
  },
  
  {
    chapter:       'intro',
    lineChartStep: 'quiz',
    title:         'Which Region Is Warming Fastest?',
    text:          'Not all parts of the planet warm equally. Some regions are experiencing change far beyond the global average. Can you guess which?',
  },
  {
    chapter:       'intro',
    //lineChartStep: 'arctic',
    title:         'Arctic Amplification',
    text:          'The Arctic is warming 4× faster than the global average. As reflective sea ice disappears, dark ocean water absorbs more heat — accelerating the warming further.',
  },
  {
    chapter:       'intro',
    //lineChartStep: 'arctic',
    title:         'The Crisis Accelerates',
    text:          'In recent decades Arctic warming has reached unprecedented rates. What happens here reshapes weather patterns, sea levels, and ecosystems across the entire planet.',
  },

  // // ── Map chapter ───────────────────────────────────────────────────────────
  {
    chapter: 'map',
    camera:  'world-overview',
    quiz:    false,
    text:    'The Arctic Ocean is normally viewed from the traditional map perspective — but try and switch to a different view so we can clearly view the entire ocean. Scroll to explore the ocean’s geography, ecosystems, and the human communities that depend on it.',
  },

  // ── Temperature chart section ─────────────────────────────────────────────
  // {
  //   chapter:       'map',
  //   camera:        'world-overview',
  //   lineChartStep: 'world',
  //   title:         'A Warming Planet',
  //   text:          'Global average temperatures have risen by over 1°C since pre-industrial times, driven by greenhouse gas emissions from fossil fuels, deforestation, and industry.',
  // },
  // {
  //   chapter:       'map',
  //   camera:        'world-overview',
  //   lineChartStep: 'quiz',
  //   title:         'Which Region Is Warming Fastest?',
  //   text:          'Not all parts of the planet are warming equally. Rising temperatures are reshaping ecosystems, agriculture, and communities worldwide.',
  // },
  
  
  {
    chapter: 'map',
    camera:  'arctic-coastline',
    title:   'Arctic Coastline',
    text:    "The Arctic Ocean is the smallest and shallowest of the world's five major oceans, covering about 14 million square kilometers. It surrounds the North Pole and is bordered by Russia, Canada, Greenland, Norway, Iceland, and the United States.",
  },

  {
    chapter: 'map',
    camera:  'arctic-quiz',
    quiz:    true,
    text:    'Six countries share a coastline with the Arctic Ocean. Can you name them all? Click each country on the map to identify it.',
  },

  // {
  //   chapter: 'map',
  //   camera:  'greenland-glaciers',
  //   title:   'Retreating Glaciers',
  //   text:    "Greenland's glaciers have been retreating at accelerating rates. Each line marks a historic ice front — a record of loss stretching back decades.",
  // },
 
  {
    chapter: 'map',
    camera:  'svalbard',
    text:    "The Arctic Ocean is home to a diverse range of marine life — polar bears, seals, walruses, whales, and many species of fish. These ecosystems are highly sensitive to changes in temperature and sea ice cover.",
  },
  // {
  //   chapter: 'map',
  //   camera:  'canada-arctic',
  //   text:    "The Arctic Ocean is facing mounting pressure from climate change. Melting sea ice threatens iconic species like polar bears and disrupts traditional ways of life for indigenous communities across the circumpolar north.",
  // },

  // ── Season chapter ────────────────────────────────────────────────────────
  {
    chapter:     'seasons',
    seasonIndex: 0,
    title:       'Arctic Night',
    text:        'During the polar night, the Arctic Ocean lies beneath a frozen mantle of darkness. For months the sun never rises. Sea ice thickens, biological activity drops to near zero, and the ecosystem enters a state of suspended animation — waiting for light to return.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 1,
    title:       'Early Spring',
    text:        'As the sun climbs back above the horizon after months of darkness, sea ice begins to thin and crack. The returning light triggers the start of the annual phytoplankton bloom — one of the most dramatic ecological pulses on Earth.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 2,
    title:       'Late Spring',
    text:        'Melting ice edges release nutrients into sun-lit surface waters, fuelling an explosive bloom. Zooplankton, fish, seabirds and marine mammals converge on this surge of life — the foundation of the entire Arctic food web.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 3,
    title:       'Early Summer',
    text:        'Open water and continuous daylight sustain peak biological productivity. But warming is pushing the bloom earlier each year, disrupting the precise seasonal timing that Arctic animals have evolved over millennia to depend on.',
  },
  // {
  //   chapter:     'seasons',
  //   seasonIndex: 4,
  //   title:       'Late Summer',
  //   text:        'As summer wanes, nutrients are depleted and the bloom fades. Sea ice begins to reform at the edges. The window of biological abundance is closing — and with each passing decade, its timing shifts in ways the Arctic ecosystem is struggling to absorb.',
  // },

  // ── SVG infographic chapter ───────────────────────────────────────────────
{
    chapter: 'svg',
    layerId: null,
    title:   null,
    text:    'From drifting sea ice to sun-lit ocean floors, the Arctic summer ecosystem is a web of life increasingly disrupted by a warming climate. Scroll to explore each layer of change.',
  },

   {
    chapter: 'svg',
    layerId: 'Sea_ice_early',
    title:   'Sea Ice',
    text:    'Arctic sea ice extent has declined ~13% per decade since satellite records began. The loss of multi-year ice fundamentally restructures the ecosystem that depends on it.',
  },

  {
    chapter: 'svg',
    layerId: 'Sun',
    title:   'Increasing Pan-Arctic productivity',
    text:    'As ice retreats, unprecedented amounts of sunlight reach previously shaded Arctic waters, fuelling new biological productivity but also accelerating ocean warming.',
  },
  {
    chapter: 'svg',
    layerId: 'productive_ocean',
    title:   'Complex Ecosystem Response',
    text:    'With increasing light in the ocean a surge in photosynthesis would be natural — Nature is although not so simple and the response of the ecosystem is complex and not fully understood.',
  },


  {
    chapter: 'svg',
    layerId: null,
    title:   null,
    text:    'From drifting sea ice to sun-lit ocean floors, the Arctic summer ecosystem is a web of life increasingly disrupted by a warming climate. Scroll to explore each layer of change.',
  },


  {
    chapter:      'svg',
    layerId:      'Mountain',
    glacierCamera: 'greenland-overview',
    title:        'Glaciers & Mountains',
    text:         "Greenland's ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes.",
  },
  {
    chapter:      'svg',
    layerId:      'Mountain',
    glacierCamera: 'greenland-glaciers',
    title:        'Retreating Ice Fronts',
    text:         "Each coloured line marks a historic glacier terminus — yellow lines show the oldest recorded positions, red the most recent. Decades of retreat visible in a single view.",
  },
    {
    chapter: 'svg',
    layerId: 'River',
    title:   'Rivers & Freshwater',
    text:    'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.',
  },
  
//   {
//     chapter: 'svg',
//     layerId: 'SaltMarch',
//     title:   'Salt Marsh',
//     text:    'Coastal wetlands act as blue carbon sinks, sequestering carbon at rates up to 10× higher than terrestrial forests. Their persistence is critical for climate mitigation.',
//   },

  {
    chapter: 'svg',
    layerId: 'Erosion',
    title:   'Coastal Erosion',
    text:    'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.',
  },
  
  
 
  {
    chapter: 'svg',
    layerId: 'Waves',
    title:   'Waves',
    text:    'Increased cloud-cover and waves further complecates the and alter the light availability in the water.',
  },
//   {
//     chapter: 'svg',
//     layerId: 'Coulds',
//     title:   'Atmosphere & Clouds',
//     text:    'Reduced ice cover lowers the surface albedo — more solar energy is absorbed by the dark ocean, creating a self-reinforcing warming feedback loop.',
//   },
  
//   {
//     chapter: 'svg',
//     layerId: 'Phytoplankton',  
//     title:   'Phytoplankton',
//     text:    'Phytoplankton blooms are expanding northward and occurring weeks earlier each season. These microscopic primary producers underpin the entire Arctic food web.',
//     figure:  <AutoChart Chart={ScatterPlot} height={220} />,
//   },
//    {
//     chapter: 'svg',
//     layerId: 'Eddy',
//     title:   'Eddy',
//     text:    'Sub-Arctic species such as Atlantic cod and mackerel are moving north as waters warm, competing with endemic species and disrupting indigenous hunting practices.',
//   },
//   {
//     chapter: 'svg',
//     layerId: 'Instruments',
//     title:   'Instruments',
//     text:    'Instruments are essential for monitoring and understanding the changing Arctic environment. They provide critical data on temperature, ice thickness, and ecosystem health.',
//   },
  // {
  //   chapter: 'svg',
  //   layerId: 'Fish',
  //   title:   'Fish',
  //   text:    'Sub-Arctic species such as Atlantic cod and mackerel are moving north as waters warm, competing with endemic species and disrupting indigenous hunting practices.',
  // },

//   {
//     chapter: 'svg',
//     layerId: 'Corals',
//     title:   'Cold-Water Corals',
//     text:    'Deep cold-water coral reefs are threatened by ocean acidification driven by rising CO₂ absorption. Their calcium carbonate skeletons dissolve as seawater pH drops.',
//   },

{
    chapter: 'svg',
    layerId: null,
    title:   null,
    text:    'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change. Lets dive into how we try to undercover these changes.',
  },

    {
    chapter: 'svg',
    layerId: 'kelp_highlight',
    title:   'How is the Arctic seafloor adapting to these changes?',
    text:    'Kelp forests are expanding into newly ice-free coastal zones, creating complex new habitats — but also competing with native seabed communities adapted to the cold.',
  },

  // ── Photosynthesis chapter ────────────────────────────────────────────────
  {
    chapter:   'photosynthesis',
    stepIndex: 0,
    title:     'Arctic Seafloor Photosynthesis',
    text:      'Beneath the Arctic summer sun, a hidden world of light and chemistry sustains all marine life. Scroll to watch photosynthesis unfold.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 0,
    title:     'Arctic Seafloor Photosynthesis',
    text:      'Beneath the Arctic summer sun, a hidden world of light and chemistry sustains all marine life. Scroll to watch photosynthesis unfold.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 1,
    title:     'The Midnight Sun',
    text:      'During the Arctic summer the sun never sets, flooding the ocean surface with continuous light — the energy source that drives the entire ecosystem.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 2,
    title:     'Light Penetration',
    text:      'Sunlight penetrates the clear Arctic water, reaching phytoplankton and sea plants below. In ice-free waters light now reaches depths it never could before.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 3,
    title:     'Oxygen & Carbon',
    text:      'Phytoplankton and seagrass convert CO₂ and sunlight into oxygen and organic carbon — the base of the food web and a critical carbon sink for the planet.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 4,
    title:     'Oxygen Rising',
    text:      'Oxygen produced by phytoplankton bubbles upward through the water column, eventually reaching the atmosphere — the Arctic Ocean is a net source of oxygen for the planet.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 5,
    title:     'Oxygen Rising',
    text:      'Oxygen produced by phytoplankton bubbles upward through the water column, eventually reaching the atmosphere — the Arctic Ocean is a net source of oxygen for the planet.',
  },

  {
    chapter:   'photosynthesis',
    stepIndex: 8,
    title:     'A Changing Cycle',
    text:      'As the Arctic warms, longer ice-free seasons extend the window for photosynthesis — but also alter nutrient cycles, ocean chemistry, and the balance of the entire ecosystem.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 9,
    title:     'A New Presence',
    text:      'For the first time in history, industrial vessels navigate waters that were impassable just decades ago. The Arctic is no longer beyond reach.',
  },
  {
    chapter:   'photosynthesis',
    stepIndex: 10,
    title:     'A New Threat',
    text:      'But a new chapter is beginning. These vessels bring oil, noise, and geopolitical ambition to one of the last great wildernesses — accelerating the very changes that opened the route.',
  },

  // ── Shipping routes chapter (ending) ─────────────────────────────────────
  {
    chapter:   'shipping',
    stepIndex: 0,
    layerId:   'Ship-1',
    title:     'The Opening Arctic',
    text:      'As sea ice retreats, Arctic shipping routes are becoming viable year-round for the first time in human history — cutting thousands of kilometres off global trade routes.',
  },
  {
    chapter:   'shipping',
    stepIndex: 1,
    layerId:   null,
    title:     'The Transpolar Route',
    text:      'The Transpolar Sea Route crosses directly over the North Pole. Once science fiction, it could become the dominant trade corridor of the 21st century.',
  },
  {
    chapter:   'shipping',
    stepIndex: 2,
    title:     'A Changed World',
    text:      'The same ice loss that is devastating Arctic ecosystems is opening the region to extraction, shipping, and military competition. The Arctic\'s future will be defined by the choices we make today.',
  },
];

const ICE_EXTENT_URL  = year => `${BASE}Ice_extent/N_${year}09_extent_v4.0.tif`;
const COG_START_YEAR  = 1880;
const COG_END_YEAR    = 2025;
const COG_YEAR_STEP   = 10;

// ── Component ─────────────────────────────────────────────────────────────────
export default function StoryScene() {
  const [viewPoint,  setViewPoint]  = useState(0);
  const [iceYear,    setIceYear]    = useState(1979);
  const [cogYear,        setCogYear]        = useState(null);
  const [scrollYear,     setScrollYear]     = useState(null);
  const [arcticRevealed, setArcticRevealed] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const step = STEPS[viewPoint] ?? STEPS[0];

  // Derive layout flags directly from the step's chapter — no magic offsets
  const sceneStarted    = step.chapter !== 'intro';
  const inWideChapter    = step.chapter === 'seasons' || step.chapter === 'svg' || step.chapter === 'photosynthesis' || step.chapter === 'shipping';
  const inSvgChapter     = step.chapter === 'svg';
  const inPhotoChapter   = step.chapter === 'photosynthesis';
  const inShippingChapter  = step.chapter === 'shipping';

  // Season accordion active tab: clamped to last index once SVG chapter starts
  const seasonIndex = step.chapter === 'seasons' ? step.seasonIndex
                    : step.chapter === 'svg'     ? SEASONS.length - 1
                    : -1;

  const activeLayerId = step.chapter === 'svg' ? step.layerId : undefined;

  // Steps with a title or figure use the structured card layout (left-aligned);
  // plain intro/map steps render as centred text.
  // The Sea_ice figure is built here so onYearChange can update component state.
  const textInput = STEPS.map(s => {
    const figure = s.layerId === 'Sea_ice_early'
      ? <IceExtentMap getUrl={ICE_EXTENT_URL} onYearChange={setIceYear} />
      : s.lineChartStep === 'quiz'
        ? <TempQuiz onCorrectAnswer={() => { setArcticRevealed(true); }} onAnswer={() => setShowAllRegions(true)} />
        : s.figure;
    return (s.title !== undefined || figure)
      ? { title: s.title, body: s.text, figure }
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

  const leftClass = `scrolly-left ${sceneStarted ? 'show' : 'hide'} ${inWideChapter ? 'is-svg' : ''}`;

  return (
    <>
    <div style={{
      position:     'fixed',
      top:          '5vh',
      left:         'var(--page-pad)',
      width:        'calc((100vw - 2 * var(--page-pad)) * 0.60 - var(--col-gap) / 2)',
      height:       '90vh',
      borderRadius: 12,
      overflow:     'hidden',
      boxShadow:    '0 2px 10px rgba(0,0,0,0.06)',
      zIndex:       0,
      opacity:      !sceneStarted ? 1 : 0,
      pointerEvents: 'none',
      transition:   'opacity 900ms ease',
    }}>
      <CogTemperatureMap
        getUrl={year => `${BASE}tif_data/anom_${year}.tif`}
        startYear={COG_START_YEAR}
        endYear={COG_END_YEAR}
        yearStep={COG_YEAR_STEP}
        legendTitle={`Temperature Anomaly (°C)`}
        onYearChange={setCogYear}
        externalYear={scrollYear}
      />
    </div>
    <div
      className={`scrolly-layout ${sceneStarted ? 'is-split' : 'is-intro'} ${inWideChapter ? 'is-svg' : ''}`}
      style={!sceneStarted ? { position: 'relative', zIndex: 1 } : undefined}
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
          <NewMap
            cameraKey={step.chapter === 'map' ? step.camera : undefined}
            quizMode={step.quiz === true}
          />
        </div>

        {/* Wide chapter panel — circle-reveals over the map */}
        <div style={{
          position:      'absolute', inset: 0,
          borderRadius:  12, overflow: 'hidden',
          clipPath:      inWideChapter ? 'circle(150% at 50% 50%)' : 'circle(0% at 50% 50%)',
          transition:    'clip-path 1700ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: inWideChapter ? 'auto' : 'none',
          background:    'white',
        }}>

          {/* Season display */}
          <div style={{
            position:      'absolute', inset: 0,
            opacity:       inSvgChapter ? 0 : 1,
            transition:    'opacity 800ms ease',
            pointerEvents: inSvgChapter ? 'none' : 'auto',
          }}>
            <SeasonDisplay activeIndex={seasonIndex} />
          </div>

          {/* SVG infographic */}
          <div style={{
            position:   'absolute', inset: 0,
            opacity:    inSvgChapter && !inPhotoChapter ? 1 : 0,
            transition: 'opacity 800ms ease',
          }}>
            <SvgPanel
              src={`${BASE}SVG/Late_summer.svg`}
              activeLayerId={activeLayerId}
              iceYear={iceYear}
            />
          </div>

          {/* Photosynthesis animation */}
          <div style={{
            position:   'absolute', inset: 0,
            opacity:    inPhotoChapter ? 1 : 0,
            transition: 'opacity 800ms ease',
          }}>
            <PhotosynthesisPanel stepIndex={step.stepIndex ?? 0} active={inPhotoChapter} />
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

        </div>
      </aside>

      <main className="scrolly-right">
        <ScrollamaDemo
          handleUpdate={({ viewPoint: vp }) => { trackStepEnter(vp, STEPS[vp]); setViewPoint(vp); }}
          textInput={textInput}
          stickyStartIndex={stickyStartIndex}
          stickyEndIndex={stickyEndIndex}
          stickyContent={glacierCameraKey
            ? <div style={{ height: '450px', borderRadius: 8, overflow: 'hidden' }}><NewMap cameraKey={glacierCameraKey} quizMode={false} embed /></div>
            : null}
          sticky2StartIndex={sticky2StartIndex}
          sticky2EndIndex={sticky2EndIndex}
          sticky2Content={lineChartStep
            ? <div style={{ background: 'white', borderRadius: 8, padding: 16, boxShadow: '0 4px 4px rgba(0,0,0,0.04)' }}><TemperatureLineChart step={lineChartStep} currentYear={scrollYear ?? cogYear} startYear={COG_START_YEAR} endYear={COG_END_YEAR} onYearSelect={y => setScrollYear(y)} arcticRevealed={arcticRevealed} showAllRegions={showAllRegions} /></div>
            : null}
        />
      </main>
    </div>
    </>
  );
}
