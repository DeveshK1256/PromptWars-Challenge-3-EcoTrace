/**
 * @module data-feed
 * Static news feed articles, map fallback spots, and topic labels for EcoTrace.
 */

/**
 * Filter labels for the news-feed topic selector.
 * The first entry ("All") is a wildcard that shows every article.
 *
 * @type {string[]}
 */
export const NEWS_TOPICS = [
  "All",
  "Climate Change",
  "Renewable Energy",
  "Sustainability Tips",
  "World Environment News",
];

/**
 * Fallback map pins shown when the Google Places API is not configured.
 * Offsets are applied to the user's detected coordinates to place markers nearby.
 *
 * @type {Array<{
 *   id: string,
 *   category: string,
 *   name: string,
 *   address: string,
 *   latOffset: number,
 *   lngOffset: number
 * }>}
 */
export const MAP_FALLBACK_SPOTS = [
  {
    id: "ev-1",
    category: "ev",
    name: "Public EV Charging Hub",
    address: "Central business district",
    latOffset: 0.012,
    lngOffset: 0.008,
  },
  {
    id: "recycle-1",
    category: "recycling",
    name: "Community Recycling Center",
    address: "Near municipal market",
    latOffset: -0.01,
    lngOffset: 0.011,
  },
  {
    id: "tree-1",
    category: "trees",
    name: "Weekend Tree Plantation Drive",
    address: "City biodiversity park",
    latOffset: 0.018,
    lngOffset: -0.012,
  },
  {
    id: "organic-1",
    category: "organic",
    name: "Organic Farmers Market",
    address: "Sunday local market",
    latOffset: -0.016,
    lngOffset: -0.009,
  },
];

/**
 * Curated environment and climate news articles from around the world.
 * Grouped by region in source-code comments (USA, Europe, China, India, etc.).
 *
 * @type {Array<{
 *   id: string,
 *   category: string,
 *   title: string,
 *   source: string,
 *   url: string,
 *   summary: string,
 *   readMinutes: number,
 *   date: string
 * }>}
 */
export const FEED_ARTICLES = [
  // --- USA ---
  {
    id: "usa-ira-climate",
    category: "Climate Change",
    title: "How the Inflation Reduction Act is reshaping US clean energy investment",
    source: "Reuters",
    url: "https://www.reuters.com/sustainability/",
    summary: "A look at record-breaking clean energy spending across American states since the landmark climate law.",
    readMinutes: 5,
    date: "2025-04-12",
  },
  {
    id: "usa-wind-offshore",
    category: "Renewable Energy",
    title: "Offshore wind farms power up along the US East Coast",
    source: "AP News",
    url: "https://apnews.com/hub/climate-and-environment",
    summary: "New turbines off Massachusetts and New York are delivering gigawatts of emission-free electricity.",
    readMinutes: 4,
    date: "2025-03-28",
  },
  {
    id: "usa-ev-adoption",
    category: "Sustainability Tips",
    title: "EV sales in the US cross a major milestone in early 2025",
    source: "Bloomberg Green",
    url: "https://www.bloomberg.com/green",
    summary: "Tips for first-time EV buyers, from charger installation to maximising range in cold weather.",
    readMinutes: 4,
    date: "2025-02-15",
  },
  // --- Europe ---
  {
    id: "eu-green-deal",
    category: "Climate Change",
    title: "European Green Deal: progress report on the path to net-zero by 2050",
    source: "European Commission",
    url: "https://ec.europa.eu/clima/",
    summary: "The EU reviews emissions cuts, carbon border taxes, and green hydrogen targets halfway through the decade.",
    readMinutes: 6,
    date: "2025-05-03",
  },
  {
    id: "eu-carbon-border",
    category: "World Environment News",
    title: "EU carbon border adjustment begins reshaping global trade",
    source: "Financial Times",
    url: "https://www.ft.com/climate-capital",
    summary: "How the world's first carbon import tax is influencing manufacturing decisions from Asia to the Americas.",
    readMinutes: 5,
    date: "2025-01-20",
  },
  {
    id: "denmark-wind-island",
    category: "Renewable Energy",
    title: "Denmark breaks ground on its artificial energy island in the North Sea",
    source: "The Guardian",
    url: "https://www.theguardian.com/environment",
    summary: "The island will hub 200 offshore turbines, powering millions of European homes with clean electricity.",
    readMinutes: 4,
    date: "2025-04-01",
  },
  // --- China ---
  {
    id: "china-carbon-neutral",
    category: "Climate Change",
    title: "China's 2060 carbon neutrality roadmap: solar mega-farms lead the way",
    source: "South China Morning Post",
    url: "https://www.scmp.com/topics/climate-change",
    summary: "Record solar capacity additions in the Gobi Desert bring China closer to its decarbonisation pledge.",
    readMinutes: 5,
    date: "2025-03-15",
  },
  {
    id: "china-ev-exports",
    category: "Renewable Energy",
    title: "Chinese EV makers expand globally, accelerating the electric transition",
    source: "Nikkei Asia",
    url: "https://asia.nikkei.com/Spotlight/Environment",
    summary: "Affordable electric vehicles from China are reshaping auto markets in Southeast Asia and Latin America.",
    readMinutes: 4,
    date: "2025-02-08",
  },
  // --- India ---
  {
    id: "india-solar-rooftop",
    category: "Renewable Energy",
    title: "India's PM Surya Ghar scheme lights up 10 million rooftops",
    source: "EcoTrace Curated",
    url: "https://mnre.gov.in/",
    summary: "Free rooftop solar panels for households are cutting electricity bills and carbon footprints across Indian cities.",
    readMinutes: 4,
    date: "2025-05-10",
  },
  {
    id: "india-green-hydrogen",
    category: "Renewable Energy",
    title: "India bets big on green hydrogen to decarbonise heavy industry",
    source: "Hindustan Times",
    url: "https://www.hindustantimes.com/environment",
    summary: "New electrolyser plants aim to make India a global hub for green hydrogen exports by 2030.",
    readMinutes: 5,
    date: "2025-04-22",
  },
  {
    id: "india-air-quality",
    category: "World Environment News",
    title: "Delhi's new electric bus fleet helps improve winter air quality",
    source: "The Hindu",
    url: "https://www.thehindu.com/sci-tech/energy-and-environment/",
    summary: "Over 2,000 electric buses now ply Delhi roads, contributing to a measurable drop in PM2.5 levels.",
    readMinutes: 4,
    date: "2025-01-18",
  },
  // --- Brazil / Amazon ---
  {
    id: "brazil-amazon-deforestation",
    category: "Climate Change",
    title: "Amazon deforestation falls to a 10-year low under new enforcement",
    source: "BBC News",
    url: "https://www.bbc.com/news/science-environment",
    summary: "Satellite data confirms a significant slowdown in forest loss across Brazil's Amazon basin.",
    readMinutes: 5,
    date: "2025-03-05",
  },
  {
    id: "brazil-biofuels",
    category: "Renewable Energy",
    title: "Brazil's sustainable aviation fuel industry takes flight",
    source: "Reuters",
    url: "https://www.reuters.com/business/energy/",
    summary: "Sugarcane-based jet fuel is positioning Brazil as a leader in decarbonising global aviation.",
    readMinutes: 4,
    date: "2025-02-25",
  },
  // --- Africa ---
  {
    id: "africa-solar-mini-grids",
    category: "Renewable Energy",
    title: "Solar mini-grids bring clean power to 50 million people across sub-Saharan Africa",
    source: "Al Jazeera",
    url: "https://www.aljazeera.com/tag/climate-crisis/",
    summary: "Distributed solar is leapfrogging fossil-fuel infrastructure in rural communities from Kenya to Nigeria.",
    readMinutes: 5,
    date: "2025-04-18",
  },
  {
    id: "kenya-geothermal",
    category: "World Environment News",
    title: "Kenya generates over 90% of electricity from renewables",
    source: "CNN",
    url: "https://edition.cnn.com/specials/world/cnn-climate",
    summary: "Geothermal and wind power make Kenya one of the greenest grids on the African continent.",
    readMinutes: 4,
    date: "2025-01-30",
  },
  {
    id: "great-green-wall",
    category: "World Environment News",
    title: "Africa's Great Green Wall crosses a key reforestation milestone",
    source: "UN Environment",
    url: "https://www.unep.org/",
    summary: "The 8,000 km tree-planting initiative across the Sahel is restoring degraded land and improving livelihoods.",
    readMinutes: 5,
    date: "2025-05-01",
  },
  // --- Australia ---
  {
    id: "australia-reef-coral",
    category: "World Environment News",
    title: "Great Barrier Reef shows signs of recovery after two cooler summers",
    source: "ABC Australia",
    url: "https://www.abc.net.au/news/topic/climate-change",
    summary: "Marine biologists report coral regrowth in key sections, though long-term threats remain.",
    readMinutes: 5,
    date: "2025-03-20",
  },
  {
    id: "australia-battery-storage",
    category: "Renewable Energy",
    title: "Australia's mega-battery projects stabilise the renewable grid",
    source: "The Sydney Morning Herald",
    url: "https://www.smh.com.au/environment",
    summary: "Giant lithium-ion batteries in South Australia and Victoria smooth out solar and wind variability.",
    readMinutes: 4,
    date: "2025-02-12",
  },
  // --- Japan & South Korea ---
  {
    id: "japan-hydrogen-economy",
    category: "Renewable Energy",
    title: "Japan advances its hydrogen economy with new fuel-cell ships and trucks",
    source: "Japan Times",
    url: "https://www.japantimes.co.jp/environment/",
    summary: "Tokyo's hydrogen strategy extends beyond cars to heavy transport and industrial heating.",
    readMinutes: 5,
    date: "2025-04-08",
  },
  {
    id: "south-korea-floating-solar",
    category: "Renewable Energy",
    title: "South Korea builds the world's largest floating solar farm",
    source: "Korea Herald",
    url: "https://www.koreaherald.com/section/environment",
    summary: "Panels on reservoirs generate clean power without taking up precious farmland.",
    readMinutes: 4,
    date: "2025-01-25",
  },
  // --- Middle East ---
  {
    id: "uae-solar-megaproject",
    category: "Renewable Energy",
    title: "UAE's Al Dhafra solar plant becomes one of the world's largest",
    source: "Gulf News",
    url: "https://gulfnews.com/uae/environment",
    summary: "The 2 GW facility powers 200,000 homes and underlines the Gulf's pivot from oil to solar.",
    readMinutes: 4,
    date: "2025-03-10",
  },
  {
    id: "saudi-neom-green",
    category: "World Environment News",
    title: "Saudi Arabia's NEOM project aims for 100% renewable-powered city",
    source: "Arab News",
    url: "https://www.arabnews.com/tags/climate",
    summary: "The futuristic mega-city in the desert plans to run entirely on wind, solar, and green hydrogen.",
    readMinutes: 5,
    date: "2025-02-18",
  },
  // --- Arctic / Antarctic ---
  {
    id: "arctic-ice-loss",
    category: "Climate Change",
    title: "Arctic sea ice hits another record low as warming accelerates",
    source: "National Geographic",
    url: "https://www.nationalgeographic.com/environment/",
    summary: "Scientists warn that summer ice-free conditions could arrive a decade earlier than previous models predicted.",
    readMinutes: 5,
    date: "2025-04-25",
  },
  {
    id: "antarctic-ice-shelf",
    category: "Climate Change",
    title: "Antarctic ice shelf collapse raises sea-level projections worldwide",
    source: "Nature",
    url: "https://www.nature.com/nclimate/",
    summary: "New research links warm ocean currents to accelerating ice-shelf thinning around the Thwaites Glacier.",
    readMinutes: 6,
    date: "2025-05-08",
  },
  // --- Ocean & Marine Conservation ---
  {
    id: "ocean-plastic-treaty",
    category: "World Environment News",
    title: "Historic UN ocean plastic treaty sets binding reduction targets",
    source: "UN News",
    url: "https://news.un.org/en/story/2025/01/ocean-plastic-treaty",
    summary: "Nations agree to cut plastic production and fund cleanup of the Great Pacific Garbage Patch.",
    readMinutes: 5,
    date: "2025-01-15",
  },
  {
    id: "coral-reef-restoration",
    category: "Sustainability Tips",
    title: "How coral gardening is helping restore reefs in the Caribbean",
    source: "Smithsonian",
    url: "https://ocean.si.edu/",
    summary: "Volunteer divers and marine biologists are planting lab-grown corals to rebuild damaged ecosystems.",
    readMinutes: 4,
    date: "2025-03-18",
  },
  // --- Sustainable Agriculture ---
  {
    id: "regen-agriculture-usa",
    category: "Sustainability Tips",
    title: "Regenerative farming practices spread across the American Midwest",
    source: "The Washington Post",
    url: "https://www.washingtonpost.com/climate-environment/",
    summary: "Cover crops and no-till methods are improving soil health while sequestering carbon on large-scale farms.",
    readMinutes: 5,
    date: "2025-04-05",
  },
  {
    id: "vertical-farming-singapore",
    category: "Sustainability Tips",
    title: "Singapore's vertical farms aim to grow 30% of food locally by 2030",
    source: "Straits Times",
    url: "https://www.straitstimes.com/tags/sustainability",
    summary: "High-tech indoor farms use 95% less water and zero pesticides to grow leafy greens in the city-state.",
    readMinutes: 4,
    date: "2025-02-20",
  },
  {
    id: "agroforestry-indonesia",
    category: "Sustainability Tips",
    title: "Indonesian farmers combine coffee growing with forest restoration",
    source: "Mongabay",
    url: "https://news.mongabay.com/",
    summary: "Agroforestry projects on Sumatra show that shade-grown coffee protects biodiversity and boosts incomes.",
    readMinutes: 4,
    date: "2025-03-12",
  },
  // --- Extra Global Stories ---
  {
    id: "canada-wildfire-climate",
    category: "Climate Change",
    title: "Canada's record wildfire seasons linked directly to climate change",
    source: "CBC News",
    url: "https://www.cbc.ca/news/climate",
    summary: "Studies confirm that rising temperatures and drought are making Canadian forests more fire-prone each year.",
    readMinutes: 5,
    date: "2025-05-15",
  },
  {
    id: "food-waste-global",
    category: "Sustainability Tips",
    title: "Five household habits that cut food waste without extra spending",
    source: "EcoTrace Curated",
    url: "https://www.fao.org/platform-food-loss-waste/",
    summary: "Simple storage, planning, and reuse ideas that reduce methane emissions from wasted food.",
    readMinutes: 3,
    date: "2025-01-10",
  },
];
