const BASE = import.meta.env.BASE_URL;

export const TIMELINE_H = 68;

export const COG_START_YEAR      = 1880;
export const COG_END_YEAR        = 2025;
export const IMAGE_SEQUENCE_END  = 0.90;
export const MAP_TRANSITION_START = IMAGE_SEQUENCE_END;

export const ICE_EXTENT_URL = year => `${BASE}Ice_extent/N_${year}09_extent_v4.0.tif`;

export const CHAPTERS = [
  { id: 'intro',          label: 'Introduction' },
  { id: 'map',            label: 'Arctic Ocean' },
  { id: 'seasons',        label: 'Seasons'      },
  { id: 'svg',            label: 'Ecosystem'    },
  { id: 'photosynthesis', label: 'Seafloor'     },
];

export const SEASONS = [
  { label: 'Arctic Night', src: `${BASE}SVG/Arctic_night.svg` },
  { label: 'Early Spring', src: `${BASE}SVG/Early_spring.svg` },
  { label: 'Late Spring',  src: `${BASE}SVG/Late_spring.svg`  },
  { label: 'Autumn',       src: `${BASE}SVG/Early_Summer.svg` },
  { label: 'Summer',       src: `${BASE}SVG/Late_summer.svg`  },
];

const INTRO_WARMING_TEXT = 'The planet is getting warmer, but the change is not spread evenly. Some regions are heating much faster than others. Drag the year marker across the chart to see how warming has unfolded around the world.';
// KA: "Earth's average temperature has risen over 1.2°C since 1880 – but this warming is not felt equally everywhere. Drag the chart to explore how different regions have changed over time."

export const STEPS = [

  // ── Intro ─────────────────────────────────────────────────────────────────

  {
    chapter:       'intro',
    camera:        'intro-arctic',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          INTRO_WARMING_TEXT,
  },
  {
    chapter:       'intro',
    lineChartStep: 'world',
    title:         'A Warming World',
    text:          INTRO_WARMING_TEXT,
  },
  {
    chapter:       'intro',
    lineChartStep: 'quiz',
    title:         null,
    text:          'Some regions are changing at, two, three, or even four times the global rate. Looking at the colors on the map, which region do you think is changing fastest?',
    // KA: 'Some regions are changing at two, three, even four times the global rate. Can you guess which region is changing fastest?'
  },

  // ── Map chapter ───────────────────────────────────────────────────────────

  {
    chapter: 'map',
    camera:  'world-overview',
    title:   'What is the Arctic Ocean?',
    text:    'To understand why the Arctic is changing so quickly, we first need to look at the ocean itself. Let us shift the map north and explore some of the features that make this region so distinct.',
    // KA: "Let's switch the map perspective to the Arctic Ocean and zoom in to explore the unique features of this remote and rapidly changing region."
  },
  {
    chapter: 'map',
    camera:  'arctic-coastline',
    title:   'The Arctic Coastline',
    text:    'One of the largest continuous coastlines in the world, the Arctic coast is shaped by the small inlets and fjords that carve into the land. The coastal zone varies widely and ranges from permafrost tundra along the Russian coast to towering glaciers in Greenland. In contrast to Antarctica, the Arctic Ocean is a small, shallow ocean surrounded by land.',
    // KA: 'One of the largest continuous coastlines in the world, the Arctic coast is shaped by the small inlets and fjords that carve into the land. The coastal zone varies widely and ranges from permafrost tundra along the Russian coast to towering glaciers in Greenland. In contrast to Antarctica, the Arctic Ocean is a small, shallow ocean surrounded by land.'
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
    text:    'The Arctic Ocean has a large shallow continental shelf (0-200 m depth), which makes up more than half of its total area. This shelf area is critical habitat for Arctic marine life and supports rich biodiversity, including substantial plant life ranging from microscopic algae to large seaweeds, making it a vital part of the region\'s ecosystem.',
    
    // 'The large shallow continental shelf (0-200 m), which covers approximately 50% of the total area in the Arctic Ocean. This shelf is a large habitat for Arctic marine life and supports rich biodiversity. Its shallow waters are also where much of the Arctic\'s algae production occurs, from seaweed to microscopic phytoplankton and microphytobenthos, making it a vital part of the region\'s ecosystem.',
    // KA: 'The Arctic Ocean has a large shallow continental shelf (0-200 m depth), which makes up more than half of its total area. This shelf area is critical habitat for Arctic marine life and supports rich biodiversity, including substantial plant life ranging from microscopic algae to large seaweeds, making it a vital part of the region\'s ecosystem.'
  },
  {
    chapter: 'map',
    camera:  'svalbard',
    title:   'The Arctic Seasonal Cycle',
    text:   "Let's take a closer look at the seasonal cycle of the Arctic ocean, which is one of the most extreme and dynamic on Earth.",
    // KA: "Let's take a closer look at the seasonal cycle of the Arctic ocean, which is one of the most extreme and dynamic on Earth."
  },

  // ── Season chapter ────────────────────────────────────────────────────────

  {
    chapter:     'seasons',
    seasonIndex: 0,
    title:       'Arctic Winter',
    // KA title:  'Arctic Winter' (unchanged)
    image:       { src: `${BASE}Winter.jpg`, caption: 'North East Greenland, ??' },
    text:        'During the Arctic winter, the Arctic Ocean lies beneath a frozen mantle. For months, the sun never rises. As air temperature drops, sea ice and snow cover thickens, and the ecosystem enters a state of near-darkness.',
    // 'During the Arctic winter, the Arctic Ocean lies beneath a frozen mantle of darkness. For months the sun never rises. Sea ice thickens, biological activity drops to near zero, and the ecosystem enters a state of hibernation — waiting for light to return.',
    // KA: 'During the Arctic winter, the Arctic Ocean lies beneath a frozen mantle. For months, the sun never rises. As air temperature drops, sea ice and snow cover thickens, and the ecosystem enters a state of near-darkness.'
  },
  {
    chapter:     'seasons',
    seasonIndex: 1,
    title:       'Arctic Spring',
    // KA title:  'Arctic Spring'
    image:       { src: `${BASE}Sea_ice_breakup.jpg`, caption: 'North East Greenland' },
    text:       'As the sun climbs back above the horizon, snow begins to melt, and sea ice thins and cracks. The returning sunlight triggers the first bloom of algae in the water column.',
    // KA: 'As the sun climbs back above the horizon, snow begins to melt, and sea ice thins and cracks. The returning sunlight triggers the first bloom of algae in the water column.'
  },
  {
    chapter:     'seasons',
    seasonIndex: 2,
    title:       'Arctic Spring',
    // KA title:  'Arctic Spring'
    image:       { src: `${BASE}Phyplankton_bloom.webp`, caption: 'West coast of the Svalbard Archipelago, European Union, Copernicus Sentinel-2 imagery' },
    text:        'By late spring, the sea ice is gone in some parts of the coastal area and the ocean is entering a productive phase. Large phytoplankton blooms color the ocean water and the light green hues can be seen from space as seen in the image above.',
    // KA: 'By late spring, the sea ice is gone in some parts of the coastal area and the ocean is entering a productive phase. Large phytoplankton blooms color the ocean water and the light green hues can be seen from space as seen in the image below.'
  },
  {
    chapter:     'seasons',
    seasonIndex: 4,
    title:       'Arctic Summer',
    // KA title:  'Arctic Summer'
    image:       { src: `${BASE}Summer.jpg`, caption: 'North East Greenland, August 2024' },
    text:        'The summer is the peak of biological productivity in the Arctic ocean and sea ice continues to melt until mid-September. However, soon sea ice begins to shape the coastal waters again.',
    // KA: 'The summer is the peak of biological productivity in the Arctic ocean and sea ice continues to melt until mid-September. However, soon sea ice begins to shape the coastal waters again.'
  },

  // ── SVG infographic chapter ───────────────────────────────────────────────

  {
    chapter:     'svg',
    layerId:     'illustration_layers',
    title:       'Changing Arctic Ecosystem',
    bubble:      {},
    text:        'The Arctic coastal ecosystem is complex and the changes we are seeing are interconnected. Let\'s break down some of the key changes happening in the coastal zone.',
  },
  {
    chapter: 'svg',
    layerId: 'Sea_ice_early',
    title:   'Declining Sea Ice',
    bubble:  { arrow: 'right', width: 560, offsetY: -4, minScale: 0.86, fontScale: 1.1 },
    text:    'The Arctic minimum sea ice extent has declined by ~13% per decade since satellite records began in 1979. The old sea ice has largely been replaced by thinner, younger ice that forms each autumn and melts again by summer. Drag the slider to follow the changes from 1979 to 2025',
    //'The Arctic minimum sea ice extent has declined ~13% per decade since satellite records began in 1979. The old sea ice has been replaced by thinner, younger ice that forms each autumn and melts again by summer. The shallow coastal zone is now mostly ice-free during the summer season and the retreating sea ice is exposing more of the Arctic ocean to sunlight. This is a fundamental change for the Arctic ecosystem.',
    // KA: 'The Arctic minimum sea ice extent has declined by ~13% per decade since satellite records began in 1979. The old sea ice has largely been replaced by thinner, younger ice that forms each autumn and melts again by summer. Drag the slider to follow the changes from 1979 to 2025'
  },
  {
    chapter: 'svg',
    layerId: 'Light_production',
    title:   'Increasing Arctic Ocean Productivity',
    // KA title: 'Increasing Arctic Productivity'
    bubble:  { arrow: 'right' },
    text: 'As ice retreats, sunlight reaches previously shaded Arctic waters and increasingly illuminates large regions in shallow waters earlier in the season. This increases the potential growth area for microscopic algae, seaweeds, and seagrasses in the Arctic ocean.',  
    // 'As ice retreats, sunlight reaches previously shaded Arctic waters and light is playing a bigger role earlier in the season in the shallow waters. This increases the growth area for algae species in the watercolumn but its difficult to know how it will affect algae species on the Arctic seafloor.',
    // KA: 'As ice retreats, sunlight reaches previously shaded Arctic waters and increasingly illuminates large regions in shallow waters earlier in the season. This increases the potential growth area for microscopic algae, seaweeds, and seagrasses in the Arctic ocean.'
  },
  {
    chapter: 'svg',
    layerId: 'productive_ocean',
    title:   'Complex Ecosystem Response',
    bubble:  { arrow: 'right' },
    text:    'The retreating sea ice is just one part of a complex web of changes in the Arctic coastal zone and some changes might have opposing effects on the ecosystem. Lets take a closer look at some of the other changes happening in the coastal zone.',
    // KA: 'However, the retreating sea ice and sunlight is just one part of a complex web of changes in the Arctic coastal zone. In fact, some changes might have complex or opposing effects on the ecosystem. Lets take a closer look at some of the other changes happening in the coastal zone.'
  },
  {
    chapter:       'svg',
    layerId:       'Mountain',
    glacierCamera: 'greenland-overview',
    title:         'Glaciers in Retreat',
    bubble:        { arrow: 'left' },
    text:          'Greenland\'s ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes.'
    // KA: "Greenland's ice sheet and Arctic glaciers are losing mass at record rates, contributing ~1 mm per year to global sea level rise and reshaping coastal landscapes."
  },
  {
    chapter: 'svg',
    layerId: 'River',
    title:   'Rivers & Freshwater',
    bubble:  { arrow: 'left' },
    text:    'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.',
    // KA: 'Accelerating permafrost thaw drives increased freshwater and nutrient runoff into coastal waters, altering salinity, turbidity, and the Arctic nutrient balance.'
  },
  {
    chapter: 'svg',
    layerId: 'Erosion_turbid',
    title:   'Increased Water Turbidity',
    image:   { src: `${BASE}/Images/2022-07-07.jpg`, caption: 'Svalbard, July 2022', height: 320 },
    bubble:  { width: 600 },
    text:    'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year – threatening communities and releasing stored carbon.',
    // KA: 'Permafrost thaw and increased wave action are consuming Arctic coastlines at up to 20 metres per year – threatening communities and releasing stored carbon.'
  },
  {
    chapter: 'svg',
    layerId: 'Waves',
    title:   'Waves',
    image:   { src: `${BASE}Waves.jpg`, caption: 'North East Greenland, August 2024' },
    bubble:  { arrow: 'bottom' },
    text:   'Increased summer cloud-cover and waves further complicate and alter the light availability in the water.'
    // KA: 'Increased summer cloud-cover and waves further complicate and alter the light availability in the water.'
  },
  {
    chapter: 'svg',
    layerId: 'kelp_highlight',
    title:   'How is the Arctic Seafloor Adapting',
    // KA title: 'How is the Arctic Seafloor Adapting?'
    image:   { src: `${BASE}Micro.jpg`, caption: 'Antarctic' },
    bubble:  { width: 500 },
    text:   'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change in the Arctic ocean. We want to understand how seafloor ecosystems respond to sunlight. When are they most active? When do they grow? And how does the energy they produce move through the broader food web?',
    // KA: 'Our research is focusing on how the Arctic seafloor is adapting to this complex web of change in the Arctic ocean. We want to understand how seafloor ecosystems respond to sunlight. When are they most active? When do they grow? And how does the energy they produce move through the broader food web?'
  },

  // ── Photosynthesis chapter ────────────────────────────────────────────────

  {
    chapter:             'photosynthesis',
    layerId:             null,
    bubbleAnchorLayerId: 'Sea_weed',
    bubble:              { arrow: 'right' },
    title:               'Arctic Seafloor Photosynthesis',
    text:               "Due to the Arctic's extensive shallow shelf regions, the Arctic seafloor is a dynamic environment where photosynthesis plays a crucial role in supporting marine life.",
    // KA: "Due to the Arctic's extensive shallow shelf regions, the Arctic seafloor is a dynamic environment where photosynthesis plays a crucial role in supporting marine life."
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Sea_weed',
    title:   'Arctic Seafloor Photosynthesis',
    // KA title: 'Marine Plants & Photosynthesis'
    bubble:  { arrow: 'right' },
    text:   'Marine plants, including microalgae, seaweeds, and seagrasses, require sunlight to drive photosynthesis. During this process, they take up dissolved carbon dioxide from seawater and convert it into organic matter, which fuels their growth and survival. At the same time, they release oxygen back into the water. By tracking the amount of oxygen they produce, we can understand their rates of photosynthetic production.',
    // 'Seaweeds and tiny algae on the seafloor use energy from sunlight to grow. Like plants on land, they use this light to take carbon dioxide from the water and turn it into new living material. At the same time, they release oxygen. \nIn shallow Arctic coastal waters, this growth can provide food and habitat for life near the seabed.',
    // KA: 'Marine plants, including microalgae, seaweeds, and seagrasses, require sunlight to drive photosynthesis. During this process, they take up dissolved carbon dioxide from seawater and convert it into organic matter, which fuels their growth and survival. At the same time, they release oxygen back into the water. By tracking the amount of oxygen they produce, we can understand their rates of photosynthetic production.'
  },
  {
    chapter:         'photosynthesis',
    layerId:         'Sun',
    isErosionSlider: true,
    bubble:          { arrow: 'bottom' },
    title:           'From Ice to Turbid Waters',
    text:            'Turbid waters reduce light penetration, which can limit the amount of light reaching the seafloor for photosynthesis. Lets look further into how we can explore the impacts of these changes on the Arctic seafloor ecosystem.',
    // KA: 'Turbid waters reduce light penetration, which can limit the amount of light reaching the seafloor for photosynthesis. Lets look further into how we can explore the impacts of these changes on the Arctic seafloor ecosystem.''
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Eddy',
    bubble:  { arrow: 'right' },
    image:   { src: `${BASE}Eddy_deploy.webp`, caption: 'Baltic Sea' },
    title:   'Eddy Covariance System',
    // KA title: 'Seafloor Observatories'
    text:    'Understanding complex Arctic ecosystems requires continuous observations in the water and on the seafloor. Satellites in space can track surface conditions, but the vast ocean depths largely remain hidden. To understand what is happening on the seafloor, we deploy small landers that photograph the seafloor, track sunlight availability, measure ice conditions, and determine oxygen production.',
    // KA: 'Understanding complex Arctic ecosystems requires continuous observations in the water and on the seafloor. Satellites in space can track surface conditions, but the vast ocean depths largely remain hidden. To understand what is happening on the seafloor, we deploy small landers that photograph the seafloor, track sunlight availability, measure ice conditions, and determine oxygen production.'
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Instruments',
    bubble:  { arrow: 'right' },
    title:   'Measuring Instruments',
    text:    'The eddy covariance system measures tiny changes in oxygen concentration together with the movement of water just above the seafloor.\n\nBy combining these measurements, we can estimate how much oxygen the seafloor community produces during photosynthesis and how much it consumes through respiration. This gives us a direct window into the productivity of Arctic seafloor habitat.',
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Benthic_highlight',
    bubble:  { arrow: 'bottom' },
    title:   'Expanding Benthic Communities',
    text:   'As sea ice retreats, sunlight may increasingly reach the seafloor, promoting the expansion of photosynthetic organisms in Arctic waters. Currently, large uncertainties exist on how much of the Arctic seafloor is exposed to sunlight, for how long, and what factors affect the establishment of photosynthetic production on the seafloor.',
    // KA: 'As sea ice retreats, sunlight may increasingly reach the seafloor, promoting the expansion of photosynthetic organisms in Arctic waters. Currently, large uncertainties exist on how much of the Arctic seafloor is exposed to sunlight, for how long, and what factors affect the establishment of photosynthetic production on the seafloor.'
  },
  {
    chapter: 'photosynthesis',
    layerId: 'g84',
    bubble:  {},
    title:   'A Changing Cycle',
    text:    'Longer ice-free seasons can extend the period when sunlight reaches the Arctic seafloor, potentially increasing photosynthesis in shallow coastal areas.\n\nBut this change also reshapes the entire ecosystem. Less sea ice, more light, and increasing water turbidity can alter when and where the seafloor algae expand to.',
    // KA: 'As the Arctic continues to warm at a record rate, higher temperatures and longer ice-free seasons potentially extend the productive period, but at what cost to marine ecosystems?'
  },
  {
    chapter: 'photosynthesis',
    layerId: 'Ships',
    bubble:  { cta: 'Take the evaluation →' },
    title:   'The Future Arctic Ocean',
    text:    'As the temperature increases and the sea ice retreats, the Arctic Ocean is becoming more accessible for longer parts of the year.\nThis future brings new opportunities and pressures on the fragile marine ecosystems - so let\'s understand the current complexities before new ones are introduced.\n\nBefore you leave, we invite you to reflect on the story and share your perspective.',
  },

  {
    chapter: 'evaluation',
    layerId: null,
    title:   null,
    text:    null,
  },
];
