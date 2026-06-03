import { trackEvent, trackStep, flushToSheet } from '../tracker.js';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import ScrollamaDemo from '../components/Scrollytelling.jsx';
import NewMap from '../components/Map.jsx';
import FrontPage from '../components/FrontPage.jsx';
import SvgPanel from '../components/Svg.jsx';
import IceExtentMap from '../components/IceExtentMap.jsx';
import PhotosynthesisPanel from '../components/Photosynthesis.jsx';
import ShippingRoutesPanel from '../components/ShippingRoutesPanel.jsx';
import TemperatureLineChart, { TempQuiz } from '../components/TemperatureLineChart.jsx';

const TIMELINE_H = 68; // px — height of the bottom chapter bar

// ── Chapter timeline (bottom of screen) ──────────────────────────────────────
const CHAPTERS = [
  { id: 'intro',          label: 'Introduction'   },
  { id: 'map',            label: 'Arctic Ocean'   },
  // { id: 'polar',          label: 'Coastal Zone'   },
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
// `text` can be a plain string OR an array of strings / { image, alt?, caption? } objects.
// Multiple bubbles per step: pass step.bubble as an array in STEPS.
// Renders only when an anchor position is known — x/y come directly from the SVG dot.
function BubbleContent({ text }) {
  if (!text) return null;
  const items = Array.isArray(text) ? text : [text];
  return (
    <>
      {items.map((item, i) => {
        if (typeof item === 'string') {
          return (
            <div key={i} style={{ fontSize: '0.97rem', lineHeight: 1.65, color: '#3d5166', marginBottom: 8 }}>
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
                <div style={{ fontSize: '0.97rem', lineHeight: 1.65, color: '#3d5166' }}>{item.text}</div>
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
                style={{ width: '100%', borderRadius: 7, display: 'block', objectFit: 'cover' }}
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
      <BubbleContent text={text} />
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
  { label: 'Autumn', src: `${BASE}SVG/Early_Summer.svg` },
  { label: 'Summer',  src: `${BASE}SVG/Late_summer.svg`  },
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
    chapter: 'intro',
    camera:  'intro-arctic',
    title:   'The Global Climate ',
      text:  'The ',
      image: `${BASE}HomePage.jpeg`,
    },
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          "Earth's average temperature has risen over 1.2°C since 1880 — but this warming is not felt equally everywhere. Drag the chart to explore how different regions have changed over time.",
  },
  // {
  //   chapter:       'intro',
  //   lineChartStep: 'world',
  //   title:         'Try',
  //   text:          'Global average temperatures have now risen over 1°C since pre-industrial times — driving more frequent heatwaves, storms, and rising seas worldwide.',
  // },
  {
    chapter:       'intro',
    lineChartStep: 'quiz',
    title:        null,
    text:          'Some regions are changing at two, three, even four times the global rate. Can you guess which one?',
  },
  // ── Map chapter ───────────────────────────────────────────────────────────
{
    chapter: 'map',
    camera:  'world-overview',
    title:   'What is the Arctic Ocean?',
    text:    'lets switch the map perspective to the Arctic Ocean and zoom in to explore the unique features of this remote and rapidly changing region.',
  },
  {
    chapter: 'map',
     camera:  'arctic-coastline',
    title:   'The Arctic Coastline',
    text:    'One of the largest continuous coastlines in the world, the Arctic coast is shaped by the small inlets and fjords that carve into the land. The coastal zone varies widely and ranges from permafrost tundra along the Russian coast to towering glaciers in Greenland.',
  },
  {
    chapter: 'map',
    camera:  'polar-shelf',
    title:   'Shallow Continental Shelf',
    text:    'The Arctic Ocean consists of a large shallow continental shelf (0-200 m), which covers approximately 50% of its total area. This shelf is critical habitat for Arctic marine life and supports rich biodiversity. Its shallow waters are also where much of the Arctic\'s algae production occurs, from seaweed to microscopic phytoplankton and microphytobenthos, making it a vital part of the region\'s ecosystem.',
  },

  {
    chapter: 'map',
    camera:  'svalbard',
    title:   'The Arctic Seasonal Cycle',
    // quiz:    true,
    text:    'Lets take a closer look at the seasonal cycle of the Arctic ocean, which is one of the most extreme and dynamic on Earth.',
  },
  
  

  // {
  //   chapter: 'map',
  //   camera:  'polar-shelf',
  //   title:   'The Continental Shelf',
  //   text:    'The shallow coastal zone — less than 200 metres deep — encircles much of the Arctic. This productive shelf is where sunlight reaches the seafloor, driving the ecosystems that the entire food web depends on.',
  // },

  // ── Season chapter ────────────────────────────────────────────────────────
  {
    chapter:     'seasons',
    seasonIndex: 0,
    title:       'Arctic Winter',
    image:  { src: `${BASE}Winter.jpg`, caption: 'North East Greenland, ??' },
    text:        'During the Arctic winter, the Arctic Ocean lies beneath a frozen mantle of darkness. For months the sun never rises. Sea ice thickens, biological activity drops to near zero, and the ecosystem enters a state of hibernation — waiting for light to return.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 1,
    image:  { src: `${BASE}Sea_ice_breakup.jpg`, caption: 'North East Greenland' },
    title:       'Early Spring',
    text:        'As the sun climbs back above the horizon after months of darkness, sea ice begins to thin and crack. The returning sunlight triggers the first bloom of algae in the water column.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 2,
    image:  { src: `${BASE}Phyplankton_bloom.webp`, caption: 'West coast of the Svalbard Archipelago, European Union, Copernicus Sentinel-2 imagery' },
    title:       'Late Spring',
    text:       'By late spring, the sea ice is gone in some parts of the coastal area and the ocean is entering a productive phase. The Arctic\'s unique phytoplankton blooms colors the ocean water and the light green hues can be seen from space as seen in the image below.',
  },
 
  {
    chapter:     'seasons',
    seasonIndex: 4,
    title:       'Summer',
     image:  { src: `${BASE}Summer.jpg`, caption: 'North East Greenland, August 2024' },
    text:        'The summer is the peak of biological productivity in the Arctic ocean and sea ice is at its minimum extent in mid-September. However, soon sea ice begins to shape the coastal waters again. Lets dive into how the ecosystem response to the changing climate.',
  },

  //  {
  //   chapter:     'seasons',
  //   seasonIndex: 3,
  //   title:       'Autumn',
  //   text:        'As sea ice begins to reform at the edges, the window of biological abundance is closing — and with each passing decade, its timing shifts in ways the Arctic ecosystem is struggling to absorb.',
  // },

  // ── SVG infographic chapter ───────────────────────────────────────────────
  {
    chapter: 'svg',
    layerId: null,
    title:   'Changing Arctic Ecosystem',
    text:    'The Arctic coastal ecosystem is complex and the changes we are seeing are interconnected. Let\'s break down some of the key changes happening in the coastal zone.',
  },
  {
    chapter: 'svg',
    layerId: 'Sea_ice_early',
    title:   'Declining Sea Ice',
    bubble:  { arrow: 'right' },
    text:    'The Arctic minimum sea ice extent has declined ~13% per decade since satellite records began in 1979. The old sea ice has been replaced by thinner, younger ice that forms each autumn and melts again by summer.',
  },
  {
    chapter: 'svg',
    layerId: 'Light_production',
    title:   'Increasing Pan-Arctic Productivity',
    bubble:  { arrow: 'right' },
    text:    'As ice retreats, sunlight reaches previously shaded Arctic waters and light is playing a bigger role earlier in the season in the shallow waters. This increases the growth area for algae species in the watercolumn but its difficult to know how it will affect algae species on the Arctic seafloor.',
  },
  {
    chapter: 'svg',
    layerId: 'productive_ocean',
    title:   'Complex Ecosystem Response',
    bubble:  { arrow: 'right' },
    text:    'The retreating sea ice is just one part of a complex web of changes in the Arctic coastal zone and some changes might have opposing effects on the ecosystem. Lets take a closer look at some of the other changes happening in the coastal zone.',
  },


  {
    chapter:       'svg',
    layerId:       'Mountain',
    glacierCamera: 'greenland-overview',
    title:         'Glaciers in Retreat',
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
    layerId: 'Erosion_turbid',
    title:   'Increased Water Turbidity',
    image:  { src: `${BASE}/Images/2022-07-07.jpg`, caption: 'Svalbard, July 2022', height: 320 },
    bubble:  {  width: 600 },
    text:    'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year — threatening communities and releasing stored carbon.',
  },
  {
    chapter: 'svg',
    layerId: 'Waves',
    title:   'Waves',
    image:  { src: `${BASE}Waves.jpg`, caption: 'North East Greenland, August 2024' },
    bubble:  { arrow: 'left' },
    text:    'Increased cloud-cover and waves further complicate and alter the light availability in the water.',
  },
  {
    chapter: 'svg',
    layerId: 'kelp_highlight',
    title:   'How is the Arctic Seafloor Adapting (Add image of the seafloor)?',
    image:  { src: `${BASE}Micro.jpg`, caption: 'Antarctic, ?? karl' },
    bubble:  { width: 500 },
    text:    'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change in the Arctic ocean. We want to understand how much the microorganisms grow, when they grow, and how the energy they produce moves through the food web around them.',
  },
  // {
  //   chapter: 'svg',
  //   layerId: 'kelp_highlight',
  //   title:   'How is the Arctic Seafloor Adapting?',
  //   bubble:  { arrow: 'left' },
  //   text:    'Kelp forests are expanding into newly ice-free coastal zones, creating complex new habitats — but also competing with native seabed communities adapted to the cold.',
  // },

  // ── Photosynthesis chapter ────────────────────────────────────────────────
  {
    chapter:            'photosynthesis',
    layerId:            null,
    bubbleAnchorLayerId:'Sea_weed',
    bubble:             { arrow: 'right' },
    title:              'Arctic Seafloor Photosynthesis',
    text:               'The Arctic seafloor is a dynamic environment where photosynthesis plays a crucial role in supporting marine life.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Sea_weed',
    title:   'Arctic Seafloor Photosynthesis (Add images or figure)',
    bubble:  { arrow: 'right' },
    text:    'Seaweed catches sunlight and uses it like energy. It takes carbon dioxide from the water and turns it into sugar, which helps it grow and stay alive. While it does this, it releases oxygen back into the water. The ocean breathes in carbon dioxide and breathes out oxygen, and seaweed is a big part of that process on the seafloor.',
  },
  {
    chapter:         'photosynthesis',
    layerId:         'Sun',
    isErosionSlider: true,
    bubble:          { arrow: 'right' },
    title:           'From Ice to Turbid Waters',
    text:            'Turbid waters reduce light penetration, which can limit the amount of light reaching the seafloor for photosynthesis. Lets look further into how we can explore the impacts of these changes on the Arctic seafloor ecosystem.',
  },
    {
    chapter: 'photosynthesis',
    layerId: 'Eddy',
    bubble:  { arrow: 'right' },
    title:   'Eddy Covariance System',
    text:    'To estimate the impacts of changing ocean conditions on the seafloor, we deploy an eddy covariance system on the seafloor (Karl add more)',
  },

   {
    chapter: 'photosynthesis',
    layerId: 'Instruments',
    bubble:  { arrow: 'right' },
    title:   'Measuring Instruments',
    text:    'The sensors measure oxygen concentration flow from the seafloor, which allows us to calculate how productive the seafloor is (Karl add more)',
  },

  {
    chapter: 'photosynthesis',
    layerId: 'Benthic_highlight',
    bubble:  { arrow: 'bottom' },
    title:   'Expanding Benthic communities',
    text:    'As sea ice retreats, sunlight reaches the seafloor, promoting the expansion of micro organisms in Arctic waters. Currently large uncertainties exist on how much the seafloor is producing and how much of the Arctic seafloor has potential for algae communities.',
  },

  // {
  //   chapter:         'photosynthesis',
  //   layerId:         'Sun',
  //   isErosionSlider: true,
  //   bubble:          { arrow: 'right' },
  //   title:           'From Ice to Eroded Coast',
  //   text:            'Drag the slider to see how retreating sea ice exposes the coastline to wave-driven erosion.',
  // },
   
  // {
  //   chapter: 'photosynthesis',
  //   layerId: 'Light_ray',
  //   bubble:  { arrow: 'right' },
  //   title:   'The Midnight Sun',
  //   text:    'During the Arctic summer the sun never sets, flooding the ocean surface with continuous light — the energy source that drives the entire ecosystem.',
  // },
  // {
  //   chapter: 'photosynthesis',
  //   layerId: 'Light_ray',
  //   bubble:  { arrow: 'right' },
  //   title:   'Light Penetration',
  //   text:    'Sunlight penetrates the clear Arctic water, reaching phytoplankton and sea plants below. In ice-free waters light now reaches depths it never could before.',
  // },
  // {
  //   chapter: 'photosynthesis',
  //   layerId: 'Carbon_non_turbid',
  //   bubble:  { arrow: 'right' },
  //   title:   'Oxygen & Carbon',
  //   text:    'Phytoplankton and seagrass convert CO₂ and sunlight into oxygen and organic carbon — the base of the food web and a critical carbon sink for the planet.',
  // },
  // {
  //   chapter: 'photosynthesis',
  //   layerId: 'O2',
  //   bubble:  { arrow: 'right' },
  //   title:   'Oxygen Rising',
  //   text:    'Oxygen produced by phytoplankton bubbles upward through the water column, eventually reaching the atmosphere — the Arctic Ocean is a net source of oxygen for the planet.',
  // },
  
  {
    chapter: 'photosynthesis',
    layerId: 'g84',
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
  // {
  //   chapter: 'photosynthesis',
  //   layerId: 'Oil',
  //   bubble:  { arrow: 'left' },
  //   title:   'A New Threat',
  //   text:    "But a new chapter is beginning. These vessels bring oil, noise, and geopolitical ambition to one of the last great wildernesses — accelerating the very changes that opened the route.",
  // },
 

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
const COG_START_YEAR = 1880;
const COG_END_YEAR   = 2025;
const IMAGE_SEQUENCE_END = 0.78;
const MAP_TRANSITION_START = IMAGE_SEQUENCE_END;
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

  const step = STEPS[viewPoint] ?? STEPS[0];
  const mapRevealed = true;
  const landingFading = introProgress >= MAP_TRANSITION_START;
  const introFlyTriggered = landingFading;
  const introMapOpacity = viewPoint === 0
    ? clamp01((introProgress - MAP_TRANSITION_START + 0.08) / 0.14)
    : 1;

  const navigateToChapter = (chapterId) => {
    const stepIndex = STEPS.findIndex(s => s.chapter === chapterId);
    if (stepIndex < 0) return;
    const el = document.querySelector(`[data-step="${stepIndex}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Derive layout flags directly from the step's chapter — no magic offsets
  const sceneStarted    = step.chapter !== 'intro';
  const inWideChapter    = step.chapter === 'seasons' || step.chapter === 'svg' || step.chapter === 'photosynthesis' || step.chapter === 'shipping' || step.chapter === 'polar';
  const inSvgChapter       = step.chapter === 'svg';
  const inPhotoChapter     = step.chapter === 'photosynthesis';
  const inShippingChapter  = step.chapter === 'shipping';
  const inPolarChapter     = step.chapter === 'polar';
  const inMapIntroStep     = step.chapter === 'intro' && !!step.camera;
  const mapIsFullScreen    = inMapIntroStep && !introMapShrunk;
  const showIntroMap       = step.chapter === 'intro' && (inMapIntroStep || introMapShrunk || !!step.lineChartStep);
  const introMapEntering   = showIntroMap && landingFading && !mapRevealed;

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

  const leftClass = `scrolly-left ${sceneStarted ? 'show' : 'hide'} ${inWideChapter ? 'is-svg' : ''}`;

  // Map a layer ID to a figure component for that bubble.
  // Add entries here whenever a bubble should contain an interactive figure.
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

        {/* Intro map — full-screen on step 0, left-panel with temperature layer on lineChart steps */}
        {showIntroMap && <div style={{
          position:     'fixed',
          top:          mapIsFullScreen ? 0 : '5vh',
          left:         mapIsFullScreen ? 0 : 'var(--page-pad)',
          width:        mapIsFullScreen ? '100vw' : 'calc((100vw - 2 * var(--page-pad)) * 0.60 - var(--col-gap) / 2)',
          height:       mapIsFullScreen ? '100vh' : '90vh',
          borderRadius: mapIsFullScreen ? 0 : 12,
          overflow:     'hidden',
          zIndex:       4,
          background:   '#07111c',
          opacity:      introMapEntering ? 0.45 : introMapOpacity,
          transform:    introMapEntering ? 'scale(1.025)' : 'scale(1)',
          transition:   'top 1600ms cubic-bezier(0.4,0,0.2,1), left 1600ms cubic-bezier(0.4,0,0.2,1), width 1600ms cubic-bezier(0.4,0,0.2,1), height 1600ms cubic-bezier(0.4,0,0.2,1), border-radius 1600ms cubic-bezier(0.4,0,0.2,1), opacity 950ms ease-out, transform 1200ms cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: (!mapIsFullScreen && showIntroMap && mapRevealed) ? 'auto' : 'none',
        }}>
          <NewMap
            cameraKey={mapIsFullScreen ? step.camera : showIntroMap ? 'global-temp' : undefined}
            hideGlobeToggle
            embed
            initialViewState={{ longitude: 16.57969, latitude: 77.82355, zoom: 9.508 }}
            mapRevealed={mapRevealed}
            introFlyTriggered={introFlyTriggered}
            onFlyOutComplete={() => setIntroMapShrunk(true)}
            cogUrl={year => `${BASE}tif_data/anom_${year}.tif`}
            cogYear={scrollYear ?? COG_START_YEAR}
            cogOpacity={!!step.lineChartStep && viewPoint >= 1 ? 0.62 : 0}
            useLightStyle={introMapShrunk}
          />
        </div>}

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
          <PhotosynthesisPanel activeLayerId={inPhotoChapter ? step.layerId : undefined} anchorLayerId={inPhotoChapter ? step.bubbleAnchorLayerId : undefined} active={inPhotoChapter} erosionProgress={erosionProgress} onAnchorPosition={setPhotoAnchorPos} />
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

        <div style={{ opacity: !inMapIntroStep ? 1 : 0, transition: 'opacity 900ms ease', pointerEvents: !inMapIntroStep ? 'auto' : 'none' }}>
          <ChapterTimeline currentChapter={step.chapter} onNavigate={navigateToChapter} />
        </div>
      </>,
      document.body
    )}
    {mapRevealed && <div
      className={`scrolly-layout ${sceneStarted ? 'is-split' : 'is-intro'} ${inWideChapter ? 'is-svg' : ''}`}
      style={{
        ...(!sceneStarted ? { position: 'relative', zIndex: 1 } : undefined),
        opacity:       (inSvgChapter || inPhotoChapter) ? 0 : 1,
        transition:    'opacity 2000ms ease',
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
          {!mapIsFullScreen && (
            <NewMap
              cameraKey={step.chapter === 'map' ? step.camera : undefined}
              quizMode={step.quiz === true}
            />
          )}
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
            opacity:       (inSvgChapter || inPhotoChapter || inShippingChapter || inPolarChapter) ? 0 : 1,
            transition:    'opacity 800ms ease',
            pointerEvents: (inSvgChapter || inPhotoChapter || inShippingChapter || inPolarChapter) ? 'none' : 'auto',
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
            if (vp === STEPS.length - 1) flushToSheet();
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
          sticky2Content={mapRevealed && lineChartStep
            ? <div style={{ background: 'white', borderRadius: 8, padding: 16, boxShadow: '0 4px 4px rgba(0,0,0,0.04)' }}><TemperatureLineChart step={lineChartStep} currentYear={scrollYear ?? COG_START_YEAR} startYear={COG_START_YEAR} endYear={COG_END_YEAR} onYearSelect={y => setScrollYear(y)} arcticRevealed={arcticRevealed} showAllRegions={showAllRegions} /></div>
            : null}
        />
      </main>
    </div>}
    </>
  );
}
