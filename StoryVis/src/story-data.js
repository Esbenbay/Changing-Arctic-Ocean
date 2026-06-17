const BASE = import.meta.env.BASE_URL;

export const TIMELINE_H = 68; // px — height of the bottom chapter bar

export const COG_START_YEAR      = 1880;
export const COG_END_YEAR        = 2025;
export const IMAGE_SEQUENCE_END  = 0.90;
export const MAP_TRANSITION_START = IMAGE_SEQUENCE_END;

export const ICE_EXTENT_URL = year => `${BASE}Ice_extent/N_${year}09_extent_v4.0.tif`;

// ── Chapter timeline ──────────────────────────────────────────────────────────
export const CHAPTERS = [
  { id: 'intro',          label: 'Introduction' },
  { id: 'map',            label: 'Arctic Ocean' },
  // { id: 'polar',          label: 'Coastal Zone' },
  { id: 'seasons',        label: 'Seasons'      },
  { id: 'svg',            label: 'Ecosystem'    },
  { id: 'photosynthesis', label: 'Seafloor'     },
  // { id: 'shipping',       label: 'Shipping'     },
];

// ── Season SVG sources ────────────────────────────────────────────────────────
export const SEASONS = [
  { label: 'Arctic Night', src: `${BASE}SVG/Arctic_night.svg` },
  { label: 'Early Spring', src: `${BASE}SVG/Early_spring.svg` },
  { label: 'Late Spring',  src: `${BASE}SVG/Late_spring.svg`  },
  { label: 'Autumn',       src: `${BASE}SVG/Early_Summer.svg` },
  { label: 'Summer',       src: `${BASE}SVG/Late_summer.svg`  },
];

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

export const STEPS = [

  // ── Intro ─────────────────────────────────────────────────────────────────

  // Step 0: full-screen satellite map at Svalbard; fly-out starts when FrontPage fades.
  // This is an invisible 600 vh spacer — the camera / fly logic live here.
  {
    chapter:       'intro',
    camera:        'intro-arctic',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          "Earth's average temperature has risen over 1.2°C since 1880 — but this warming is not felt equally everywhere. Drag the slider on the chart to explore how different regions have changed over time.",
  },
  // Step 1: first visible card — scrolls into view after the clip animation.
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          "Earth's average temperature has risen over 1.2°C since 1880 — but this warming is not felt equally everywhere. Drag the slider on the chart to explore how different regions have changed over time.",
  },
  {
    chapter:       'intro',
    lineChartStep: 'quiz',
    title:        null,
    text:          'Some regions are changing at two, three, even four times the global rate. Can you from the colors on the map guess which one has seen the largest increase in temperature?',
  },

  // ── Map chapter ───────────────────────────────────────────────────────────
  {
    chapter: 'map',
    camera:  'world-overview',
    title:   'What is the Arctic Ocean?',
    text:    'lets switch the map perspective to the Arctic Ocean and zoom in to explore some of the unique features of this remote and rapidly changing region.',
  },
  {
    chapter: 'map',
    camera:  'arctic-coastline',
    title:   'The Arctic Coastline',
    text:    'The Arctic coast is shaped by the small inlets and fjords that carve into the land, which makes it one of the largest continuous coastlines in the world. The coastal zone varies widely and ranges from permafrost tundra along the Russian coast to towering glaciers in Greenland.',
  },

  {
    chapter: 'map',
    camera:  'polar-shelf',
    bathymetryMode: 'full',
    title:   'The Arctic Ocean',
    text:    'The Arctic Ocean is the smallest and shallowest of the world\'s oceans, but its seafloor is highly varied. Broad continental shelves surround the deeper basins where water depth goes down to around 5500 meters.',
  },
  {
    chapter: 'map',
    camera:  'polar-shelf',
    bathymetryMode: 'shelf',
    title:   'Shallow Continental Shelf',
    text:    'The large shallow continental shelf (0-200 m), which covers approximately 50% of the total area in the Arctic Ocean. This shelf is a large habitat for Arctic marine life and supports rich biodiversity. Its shallow waters are also where much of the Arctic\'s algae production occurs, from seaweed to microscopic phytoplankton and microphytobenthos, making it a vital part of the region\'s ecosystem.',
  },
  {
    chapter: 'map',
    camera:  'svalbard',
    title:   'The Arctic Seasonal Cycle',
    text:    'Lets take a closer look at the seasonal cycle of the Arctic ocean, which is one of the most extreme and dynamic on Earth .',
  },

  // ── Season chapter ────────────────────────────────────────────────────────
  {
    chapter:     'seasons',
    seasonIndex: 0,
    title:       'Arctic Winter',
    image:       { src: `${BASE}Winter.jpg`, caption: 'North East Greenland, ??' },
    text:        'During the Arctic winter, the Arctic Ocean lies beneath a frozen mantle of darkness. For months the sun never rises. Sea ice thickens, biological activity drops to near zero, and the ecosystem enters a state of hibernation — waiting for light to return.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 1,
    title:       'Early Spring',
    image:       { src: `${BASE}Sea_ice_breakup.jpg`, caption: 'North East Greenland' },
    text:        'As the sun climbs back above the horizon after months of darkness, sea ice begins to thin and crack. The returning sunlight triggers the first bloom of algae in the water column and as the days grow longer, the bloom intensifies.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 2,
    title:       'Late Spring',
    image:       { src: `${BASE}Phyplankton_bloom.webp`, caption: 'West coast of the Svalbard Archipelago, European Union, Copernicus Sentinel-2 imagery' },
    text:        'By late spring, the sea ice is gone in some parts of the coastal area and the ocean is entering a productive phase. The Arctic\'s unique phytoplankton blooms colors the ocean water and the light green hues can be seen from space as seen in the image above.',
  },
  {
    chapter:     'seasons',
    seasonIndex: 4,
    title:       'Summer',
    image:       { src: `${BASE}Summer.jpg`, caption: 'North East Greenland, August 2024' },
    text:        'The summer is the peak of biological productivity in the Arctic ocean and sea ice is at its minimum extent in mid-September. However, soon sea ice begins to shape the coastal waters again. Lets dive into how the ecosystem response to the changing climate.',
  },

  // ── SVG infographic chapter ───────────────────────────────────────────────
  {
    chapter:     'svg',
    layerId: 'illustration_layers',
    title:       'Changing Arctic Ecosystem',
    bubble:  {  },
    text:        'The Arctic coastal ecosystem is complex and the changes we are seeing are interconnected. Let\'s break down some of the key changes happening in the coastal zone.',
  },
  {
    chapter: 'svg',
    layerId: 'Sea_ice_early',
    title:   'Declining Sea Ice',
    bubble:  { arrow: 'right' },
    text:    'The Arctic minimum sea ice extent has declined ~13% per decade since satellite records began in 1979. The old sea ice has been replaced by thinner, younger ice that forms each autumn and melts again by summer. The shallow coastal zone is now mostly ice-free during the summer season and the retreating sea ice is exposing more of the Arctic ocean to sunlight. This is a fundamental change for the Arctic ecosystem.',
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
    text:          "Arctic glaciers and inland snow are losing mass, which is contributing roughly ~1 mm per year to global sea level rise and reshaping coastal landscapes.",
  },
  // {
  //   chapter:       'svg',
  //   layerId:       'Mountain',
  //   glacierCamera: 'greenland-glaciers',
  //   title:         'Retreating Ice Fronts',
  //   bubble:        { arrow: 'left' },
  //   text:          "Each coloured line marks a historic glacier terminus — yellow lines show the oldest recorded positions, red the most recent. Decades of retreat visible in a single view.",
  // },
  {
    chapter: 'svg',
    layerId: 'River',
    title:   'Rivers & Freshwater',
    bubble:  { arrow: 'left' },
    text:    'Increased freshwater runoff from the melting glaciers and inland snow has increased river flow and altered sediment transport in Arctic rivers to the ocean.',
  },
  {
    chapter: 'svg',
    layerId: 'Erosion_turbid',
    title:   'Increased Water Turbidity',
    image:   { src: `${BASE}/Images/2022-07-07.jpg`, caption: 'Svalbard, July 2022', height: 320 },
    bubble:  { width: 600 },
    text:    'The increased sediment runoff from melting glaciers is contributing to higher turbidity in Arctic waters, which complicates the light availability in the water column.',
  },
  {
    chapter: 'svg',
    layerId: 'Waves',
    title:   'Waves',
    image:   { src: `${BASE}Waves.jpg`, caption: 'North East Greenland, August 2024' },
    bubble:  { arrow: 'bottom' },
    text:    'The retreating sea ice exposes the coastline to more wave action, which increases coastal erosion and can also stir up sediments in the water, making it more turbid.',
  },
  {
    chapter: 'svg',
    layerId: 'kelp_highlight',
    title:   'How is the Arctic Seafloor Adapting (Add image of the seafloor)?',
    image:   { src: `${BASE}Micro.jpg`, caption: 'Antarctic, ?? karl' },
    bubble:  { width: 500 },
    text:    'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change in the Arctic ocean. We want to understand how much the microorganisms grow, when they grow, and how the energy they produce moves through the food web around them.',
  },

  // ── Photosynthesis chapter ────────────────────────────────────────────────
  {
    chapter:             'photosynthesis',
    layerId:             null,
    bubbleAnchorLayerId: 'Sea_weed',
    bubble:              { arrow: 'right' },
    title:               'Arctic Seafloor Photosynthesis',
    text:                'The Arctic seafloor is a dynamic environment where photosynthesis plays a crucial role in supporting marine life.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Sea_weed',
    title:   'Arctic Seafloor Photosynthesis',
    bubble:  { arrow: 'right' },
    text:    'Seaweeds and tiny algae on the seafloor use energy from sunlight to grow. Like plants on land, they use this light to take carbon dioxide from the water and turn it into new living material. At the same time, they release oxygen. \nIn shallow Arctic coastal waters, this growth can provide food and habitat for life near the seabed.',
  },
  {
    chapter:         'photosynthesis',
    layerId:         'Sun',
    isErosionSlider: true,
    bubble:          { arrow: 'bottom' },
    title:           'From Ice to Turbid Waters',
    text:            'Turbid waters reduce light penetration, which can limit the amount of light reaching the seafloor for photosynthesis. Lets look further into how we can explore the impacts of these changes on the Arctic seafloor ecosystem.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Eddy',
    bubble:  { arrow: 'right' },
     image:   { src: `${BASE}Eddy_deploy.webp`, caption: 'Baltic Sea' },
    title:   'Eddy Covariance System',
    text:    'To estimate the impacts of changing ocean conditions on the seafloor, we deploy an eddy covariance system on the seafloor.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Instruments',
    bubble:  { arrow: 'right' },
    title:   'Measuring Instruments',
    text:     'The eddy covariance system measures tiny changes in oxygen concentration together with the movement of water just above the seafloor.\n\n By combining these measurements, we can estimate how much oxygen the seafloor community produces during photosynthesis and how much it consumes through respiration. This gives us a direct window into the productivity of Arctic seafloor habitats without disturbing them.',
  },
 {
  chapter: 'photosynthesis',
  layerId: 'Benthic_highlight',
  bubble:  { arrow: 'bottom' },
  title:   'Expanding Benthic Communities',
  text:    'As sea ice retreats, more sunlight can reach shallow parts of the Arctic seafloor. This may allow algae, seaweed, and microscopic benthic communities to expand into areas that were previously too dark or ice-covered for much of the year.\n\nBut large uncertainties remain. We still do not know how widespread suitable habitats are, or how changing the changing environmental conditions will impact these communities.',
},
  {
  chapter: 'photosynthesis',
  layerId: 'g84',
  bubble:  {  },
  title:   'A Changing Cycle',
  text:    'Longer ice-free seasons can extend the period when sunlight reaches the Arctic seafloor, potentially increasing photosynthesis in shallow coastal areas.\n But this change also reshapes the entire ecosystem. More light, warmer water, and increasing water turbidity can alter when and where the seafloor algae expand to.',
},
  {
  chapter: 'photosynthesis',
  layerId: 'Ships',
  bubble:  {  cta: 'Take the evaluation →' },
  title:   'Future Arctic Ocean',
  text:    'As sea ice retreats, the Arctic Ocean is becoming more accessible for longer parts of the year.\nThis future brings new opportunities and pressures on the fragile marine ecosystems - so let’s understand the current complexities before new ones are introduced.\n\n Before you leave, we invite you to reflect on the story and share your perspective.',
},

  // ── Evaluation (shown after final chapter, not in ChapterTimeline) ───────────
  {
    chapter: 'evaluation',
    layerId: null,
    title:   null,
    text:    null,
  },

  // ── Shipping routes chapter (commented out) ───────────────────────────────
  // {
  //   chapter:   'shipping',
  //   stepIndex: 0,
  //   layerId:   'Ship-1',
  //   title:     'The Opening Arctic',
  //   text:      'As sea ice retreats, Arctic shipping routes are becoming viable year-round ...',
  // },
];
