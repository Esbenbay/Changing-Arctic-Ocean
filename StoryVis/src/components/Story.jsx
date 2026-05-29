import { trackEvent, trackStep, flushToSheet } from '../tracker.js';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ScrollamaDemo from '../components/Scrollytelling.jsx';
import NewMap from '../components/Map.jsx';
import ScatterPlot from '../components/Barchart.jsx';
import SvgPanel from '../components/Svg.jsx';
import IceExtentMap from '../components/IceExtentMap.jsx';
import PhotosynthesisPanel from '../components/Photosynthesis.jsx';
import ShippingRoutesPanel from '../components/ShippingRoutesPanel.jsx';
import CogTemperatureMap from '../components/CogTemperatureMap.jsx';
import TemperatureLineChart, { TempQuiz } from '../components/TemperatureLineChart.jsx';

const TIMELINE_H = 68; // px — height of the bottom chapter bar

// ── Chapter timeline (bottom of screen) ──────────────────────────────────────
const CHAPTERS = [
  { id: 'intro',          label: 'Introduction'   },
  { id: 'map',            label: 'Arctic Ocean'   },
  { id: 'seasons',        label: 'Seasons'        },
  { id: 'svg',            label: 'Ecosystem'      },
  { id: 'photosynthesis', label: 'Seafloor'       },
  { id: 'shipping',       label: 'Shipping'       },
];

function ChapterTimeline({ currentChapter, onNavigate }) {
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

// ── Sea-ice / erosion transition slider ──────────────────────────────────────
function ErosionSlider({ onChange }) {
  const [value, setValue] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);
  const handle = e => {
    const v = Number(e.target.value) / 100;
    setValue(Number(e.target.value));
    onChange(v);
  };
  const handleDragEnd = () => {
    trackEvent('erosion_drag_complete', { value });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555' }}>
        <span>Sea Ice</span><span>Erosion</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onMouseDown={() => setHasDragged(true)}
        onTouchStart={() => setHasDragged(true)}
        onMouseUp={handleDragEnd}
        onTouchEnd={handleDragEnd}
        onChange={handle}
        style={{
          width: '100%',
          animation: !hasDragged ? 'dragPulse 1.4s ease-in-out infinite' : 'none',
        }}
      />
      <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888' }}>
        {value}% eroded
      </div>
    </div>
  );
}

// ── CSS arrow tip for text bubbles ───────────────────────────────────────────
// `direction` is where the tip POINTS: 'right' | 'left' | 'bottom' | 'top'
function ArrowTip({ direction }) {
  if (!direction) return null;
  const fill = 'rgba(255,255,255,0.97)';
  const s = 9; // half-width of base
  const base = { position: 'absolute', width: 0, height: 0 };
  const tips = {
    right:  { ...base, right:  -(s * 2), top: '50%', marginTop:  -s, borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderLeft:  `${s * 2}px solid ${fill}` },
    left:   { ...base, left:   -(s * 2), top: '50%', marginTop:  -s, borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderRight: `${s * 2}px solid ${fill}` },
    bottom: { ...base, bottom: -(s * 2), left: '50%', marginLeft: -s, borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderTop:   `${s * 2}px solid ${fill}` },
    top:    { ...base, top:    -(s * 2), left: '50%', marginLeft: -s, borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderBottom:`${s * 2}px solid ${fill}` },
  };
  return <div style={tips[direction] ?? null} />;
}

// ── Text bubble overlay for full-screen SVG chapter ──────────────────────────
// `bubble` shape: { x, y, align, arrow?, title, text, figure? }
// Multiple bubbles per step: pass step.bubble as an array in STEPS.
// Renders only when an anchor position is known — x/y come directly from the SVG dot.
function TextBubble({ title, text, x, y, arrow, figure, width }) {
  const hasFigure = Boolean(figure);
  const w = width ?? (hasFigure ? 340 : undefined);
  return (
    <div style={{
      position:             'fixed',
      left:                 `${x}%`,
      top:                  `${y}%`,
      transform:            'translate(-50%, -50%)',
      zIndex:               20,
      width:                w,
      maxWidth:             w ?? 440,
      background:           'rgba(255,255,255,0.95)',
      backdropFilter:       'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius:         14,
      padding:              '18px 22px',
      boxShadow:            '0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
      borderTop:            '3px solid #2c7fb8',
      pointerEvents:        hasFigure ? 'auto' : 'none',
      animation:            'story-fade-in 400ms ease forwards',
    }}>
      <ArrowTip direction={arrow} />
      {title && (
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 7, color: '#12263a', letterSpacing: '-0.01em' }}>
          {title}
        </div>
      )}
      {text && <div style={{ fontSize: '0.97rem', lineHeight: 1.65, color: '#3d5166', marginBottom: hasFigure ? 14 : 0 }}>{text}</div>}
      {hasFigure && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
          {figure}
        </div>
      )}
    </div>
  );
}

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
  {
    chapter:     'seasons',
    seasonIndex: 4,
    title:       'Late Summer',
    text:        'As summer wanes, nutrients are depleted and the bloom fades. Sea ice begins to reform at the edges. The window of biological abundance is closing — and with each passing decade, its timing shifts in ways the Arctic ecosystem is struggling to absorb.',
  },

  // ── SVG infographic chapter ───────────────────────────────────────────────
  {
    chapter: 'svg',
    layerId: null,
    title:   null,
    // bubble:  { x: 50, y: 50, align: 'center' },
    text:    null,
  },
  {
    chapter: 'svg',
    layerId: 'Sea_ice_early',
    title:   'Sea Ice',
    bubble:  { arrow: 'right' },
    text:    'Arctic sea ice extent has declined ~13% per decade since satellite records began. The loss of multi-year ice fundamentally restructures the ecosystem that depends on it.',
  },
  {
    chapter: 'svg',
    layerId: 'Light_production',
    title:   'Increasing Pan-Arctic Productivity',
    bubble:  { arrow: 'right' },
    text:    'As ice retreats, unprecedented amounts of sunlight reach previously shaded Arctic waters, fuelling new biological productivity but also accelerating ocean warming.',
  },
  {
    chapter: 'svg',
    layerId: 'productive_ocean',
    title:   'Complex Ecosystem Response',
    bubble:  { arrow: 'right' },
    text:    'With increasing light in the ocean a surge in photosynthesis would be natural — Nature is although not so simple and the response of the ecosystem is complex and not fully understood.',
  },


  // {
  //   chapter: 'svg',
  //   layerId: null,
  //   title:   null,
  //   bubble:  { x: 50, y: 55, align: 'center' },
  //   text:    'From drifting sea ice to sun-lit ocean floors, the Arctic summer ecosystem is a web of life increasingly disrupted by a warming climate. Scroll to explore each layer of change.',
  // },
  {
    chapter:       'svg',
    layerId:       'Mountain',
    glacierCamera: 'greenland-overview',
    title:         'Glaciers & Mountains',
    bubble:        { arrow: 'left' },
    text:          "Greenland's ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes.",
  },
  {
    chapter:       'svg',
    layerId:       'Mountain',
    glacierCamera: 'greenland-glaciers',
    title:         'Retreating Ice Fronts',
    bubble:        { arrow: 'left' },
    text:          "Each coloured line marks a historic glacier terminus — yellow lines show the oldest recorded positions, red the most recent. Decades of retreat visible in a single view.",
  },
  {
    chapter: 'svg',
    layerId: 'River',
    title:   'Rivers & Freshwater',
    bubble:  { arrow: 'left' },
    text:    'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.',
  },
  
  {
    chapter: 'svg',
    layerId: 'SaltMarch',
    title:   'Salt Marsh',
    text:    'Coastal wetlands act as blue carbon sinks, sequestering carbon at rates up to 10× higher than terrestrial forests. Their persistence is critical for climate mitigation.',
  },

  // {
  //   chapter: 'svg',
  //   layerId: 'Low_erosion',
  //   title:   'Coastal Erosion',
  //   bubble:  { x: 18, y: 64, align: 'right', arrow: 'right' },
  //   text:    'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.',
  // },
   {
    chapter: 'svg',
    layerId: 'Turbid_erosion',
    title:   'Coastal Erosion',
    bubble:  { arrow: 'right' },
    text:    'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.',
  },
  {
    chapter: 'svg',
    layerId: 'Waves',
    title:   'Waves',
    bubble:  { arrow: 'left' },
    text:    'Increased cloud-cover and waves further complicate and alter the light availability in the water.',
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
    layerId: 'kelp_highlight',
    title:   'How is the Arctic Seafloor Adapting?',
    bubble:  { arrow: 'bottom' },
    text:    'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change. Lets dive into how we try to uncover these changes.',
  },
  {
    chapter: 'svg',
    layerId: 'kelp_highlight',
    title:   'How is the Arctic Seafloor Adapting?',
    bubble:  { arrow: 'left' },
    text:    'Kelp forests are expanding into newly ice-free coastal zones, creating complex new habitats — but also competing with native seabed communities adapted to the cold.',
  },

  // ── Photosynthesis chapter ────────────────────────────────────────────────
  {
    chapter: 'photosynthesis',
    layerId: null,
    title:   'Arctic Seafloor Photosynthesis',
    text:    'Beneath the Arctic summer sun, a hidden world of light and chemistry sustains all marine life. Scroll to watch photosynthesis unfold.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Sea_weed',
    title:   'Arctic Seafloor Photosynthesis',
    text:    'Beneath the Arctic summer sun, a hidden world of light and chemistry sustains all marine life. Scroll to watch photosynthesis unfold.',
  },
  {
    chapter:         'photosynthesis',
    layerId:         'Sun',
    isErosionSlider: true,
    title:           'From Ice to Eroded Coast',
    text:            'Drag the slider to see how retreating sea ice exposes the coastline to wave-driven erosion.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Light_ray',
    bubble:  { arrow: 'right' },
    title:   'The Midnight Sun',
    text:    'During the Arctic summer the sun never sets, flooding the ocean surface with continuous light — the energy source that drives the entire ecosystem.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Light_ray',
    bubble:  { arrow: 'right' },
    title:   'Light Penetration',
    text:    'Sunlight penetrates the clear Arctic water, reaching phytoplankton and sea plants below. In ice-free waters light now reaches depths it never could before.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Carbon_non_turbid',
    bubble:  { arrow: 'right' },
    title:   'Oxygen & Carbon',
    text:    'Phytoplankton and seagrass convert CO₂ and sunlight into oxygen and organic carbon — the base of the food web and a critical carbon sink for the planet.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'O2',
    bubble:  { arrow: 'right' },
    title:   'Oxygen Rising',
    text:    'Oxygen produced by phytoplankton bubbles upward through the water column, eventually reaching the atmosphere — the Arctic Ocean is a net source of oxygen for the planet.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Eddy',
    bubble:  { arrow: 'right' },
    title:   'Oxygen Rising',
    text:    'Oxygen produced by phytoplankton bubbles upward through the water column, eventually reaching the atmosphere — the Arctic Ocean is a net source of oxygen for the planet.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Eddy',
    bubble:  { arrow: 'right' },
    title:   'A Changing Cycle',
    text:    'As the Arctic warms, longer ice-free seasons extend the window for photosynthesis — but also alter nutrient cycles, ocean chemistry, and the balance of the entire ecosystem.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Ship_1',
    bubble:  { arrow: 'left' },
    title:   'A New Presence',
    text:    'For the first time in history, industrial vessels navigate waters that were impassable just decades ago. The Arctic is no longer beyond reach.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Oil',
    bubble:  { arrow: 'left' },
    title:   'A New Threat',
    text:    "But a new chapter is beginning. These vessels bring oil, noise, and geopolitical ambition to one of the last great wildernesses — accelerating the very changes that opened the route.",
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
  const [anchorPos,      setAnchorPos]      = useState(null);
  const [photoAnchorPos, setPhotoAnchorPos] = useState(null);
  const [erosionProgress, setErosionProgress] = useState(0);

  const step = STEPS[viewPoint] ?? STEPS[0];

  const navigateToChapter = (chapterId) => {
    const stepIndex = STEPS.findIndex(s => s.chapter === chapterId);
    if (stepIndex < 0) return;
    const el = document.querySelector(`[data-step="${stepIndex}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
        ? <TempQuiz onCorrectAnswer={() => { setArcticRevealed(true); trackEvent('quiz_correct'); }} onAnswer={answer => { setShowAllRegions(true); trackEvent('quiz_answer', { answer }); }} />
        : s.isErosionSlider
          ? <ErosionSlider onChange={setErosionProgress} />
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

  // Map a layer ID to a figure component for that bubble.
  // Add entries here whenever a bubble should contain an interactive figure.
  const bubbleFigure = step.layerId === 'Sea_ice_early'
    ? <IceExtentMap getUrl={ICE_EXTENT_URL} onYearChange={setIceYear} />
    : null;

  const effectiveAnchorPos = inSvgChapter ? anchorPos : inPhotoChapter ? photoAnchorPos : null;
  const bubbleConfig = !effectiveAnchorPos || !step.bubble ? null
    : Array.isArray(step.bubble) ? step.bubble[0]
    : step.bubble;
  const bubbles = bubbleConfig ? [{
    title:  bubbleConfig.title ?? step.title,
    text:   bubbleConfig.text  ?? step.text,
    arrow:  bubbleConfig.arrow,
    figure: bubbleFigure,
    width:  step.layerId === 'Sea_ice_early' ? 480 : undefined,
    x:      effectiveAnchorPos.x,
    y:      effectiveAnchorPos.y,
  }] : [];

  return (
    <>
    {createPortal(
      <>
        {/* Full-screen SVG overlay — circle-reveals in when svg chapter starts */}
        <div style={{
          position:      'fixed', top: 0, left: 0, right: 0, bottom: TIMELINE_H, zIndex: 5,
          opacity:       inSvgChapter ? 1 : 0,
          transition:    'opacity 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: inSvgChapter ? 'auto' : 'none',
          background:    'white',
        }}>
          <SvgPanel
            src={`${BASE}SVG/Late_summer.svg`}
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
          <PhotosynthesisPanel activeLayerId={inPhotoChapter ? step.layerId : undefined} active={inPhotoChapter} erosionProgress={erosionProgress} onAnchorPosition={setPhotoAnchorPos} />
          {step.isErosionSlider && (
            <div style={{
              position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
              width: '40%', minWidth: 280, maxWidth: 480,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
              borderRadius: 14, padding: '18px 24px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
              borderTop: '3px solid #2c7fb8',
              zIndex: 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6, color: '#12263a' }}>
                From Ice to Eroded Coast
              </div>
              <ErosionSlider onChange={setErosionProgress} />
            </div>
          )}
        </div>

        {/* Text bubbles on top of the overlay — supports 1 or multiple per step */}
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
          />
        ))}

        <ChapterTimeline currentChapter={step.chapter} onNavigate={navigateToChapter} />
      </>,
      document.body
    )}
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
      style={{
        ...(!sceneStarted ? { position: 'relative', zIndex: 1 } : undefined),
        opacity:       (inSvgChapter || inPhotoChapter) ? 0 : 1,
        transition:    'opacity 500ms ease',
        pointerEvents: (inSvgChapter || inPhotoChapter) ? 'none' : 'auto',
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

          {/* Season display — hidden once SVG or Photosynthesis full-screen portal takes over */}
          <div style={{
            position:      'absolute', inset: 0,
            opacity:       (inSvgChapter || inPhotoChapter || inShippingChapter) ? 0 : 1,
            transition:    'opacity 800ms ease',
            pointerEvents: (inSvgChapter || inPhotoChapter || inShippingChapter) ? 'none' : 'auto',
          }}>
            <SeasonDisplay activeIndex={seasonIndex} />
          </div>

          {/* SVG infographic + Photosynthesis — rendered in full-screen portal above */}

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
          handleUpdate={({ viewPoint: vp }) => {
            setViewPoint(vp);
            trackStep(STEPS[vp]?.chapter);
            if (vp === STEPS.length - 1) flushToSheet();
          }}
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
