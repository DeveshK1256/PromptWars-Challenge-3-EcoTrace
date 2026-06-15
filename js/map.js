/**
 * @module map
 * @description Interactive green-spots map page for EcoTrace. Handles Google
 * Maps initialisation, category filtering, search orchestration, and a
 * comprehensive fallback dataset when API keys are unavailable. Marker
 * rendering and sidebar list management are delegated to the companion
 * `map-ui` module. Search, geocoding, and Places-API logic live in the
 * companion `map-search` module.
 */
import { ECO_CONFIG, hasMapsConfig } from "./config.js";
import { setButtonBusy, showToast } from "./app.js";
import { logWarn, logError } from "./logger.js";
import {
  CATEGORY_META,
  inferCategoryFromText,
  hasGreenIntent,
  getLocationFallback,
  stripGreenServiceWords,
  fallbackSpots,
  fetchPlacesForCategory,
  resolveLocation,
  searchPlaces,
  searchFallback,
  getCurrentPosition,
} from "./map-search.js";
import {
  setStatus,
  renderList,
  clearSpotMarkers,
  syncMarkerVisibility,
  renderSpotResults,
} from "./map-ui.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Default map centre latitude (New Delhi). */
const DEFAULT_LAT = 28.6139;

/** Default map centre longitude (New Delhi). */
const DEFAULT_LNG = 77.209;

/** Default zoom level for the initial map render. */
const DEFAULT_MAP_ZOOM = 13;

/** Scale factor for the user-location marker circle. */
const USER_MARKER_SCALE = 8;

/** Stroke weight for the user-location marker border. */
const USER_MARKER_STROKE_WEIGHT = 3;

const mapNode = document.getElementById("ecoMap");
const findButton = document.querySelector("[data-find-green-spots]");
const searchForm = document.querySelector("[data-map-search-form]");
const filters = [...document.querySelectorAll("[data-map-filter]")];
let map;
let infoWindow;
let userMarker;
let userPosition = { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
let activeCategories = new Set(Object.keys(CATEGORY_META));
let renderedSpots = [];
let markers = [];

/**
 * Returns a mutable context object referencing the current map state,
 * used by map-ui rendering functions.
 * @returns {object} Map context with map, infoWindow, markers, and activeCategories.
 */
function getCtx() {
  return { map, infoWindow, markers, activeCategories };
}

/**
 * Dynamically loads the Google Maps JavaScript SDK if not already present.
 * @returns {Promise<void>} Resolves when the SDK is available.
 */
function loadMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  const key = ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

/**
 * Synchronises the `aria-pressed` state of every category filter button
 * with the current `activeCategories` set.
 */
function updateFilterButtons() {
  filters.forEach((filter) => {
    filter.setAttribute("aria-pressed", String(activeCategories.has(filter.dataset.mapFilter)));
  });
}

/**
 * Sets the active category filter. "all" enables every category.
 * @param {string} category - Category key or "all".
 */
function setActiveCategory(category) {
  activeCategories = category === "all" ? new Set(Object.keys(CATEGORY_META)) : new Set([category]);
  updateFilterButtons();
  syncMarkerVisibility(map, markers, renderedSpots, activeCategories);
}

/**
 * Initialises (or re-initialises) the Google Map centred on the given
 * coordinates, placing a user-marker and loading green spots for all
 * categories.
 * @param {{ lat: number, lng: number }} [center=userPosition] - Map centre.
 */
async function renderMap(center = userPosition) {
  userPosition = center;
  renderedSpots = [];
  markers = clearSpotMarkers(markers);
  if (userMarker) {
    userMarker.setMap(null);
    userMarker = null;
  }

  if (!hasMapsConfig()) {
    mapNode?.classList.add("map-placeholder");
    if (mapNode) {
      mapNode.textContent =
        "Google Maps preview is in demo mode. " +
        "Add a Maps API key in js/config.js for the live map.";
    }
    renderedSpots = fallbackSpots(center);
    renderList(renderedSpots, activeCategories);
    setStatus("Showing demo green spots near the selected location.");
    return;
  }

  await loadMapsScript();
  mapNode?.classList.remove("map-placeholder");
  if (mapNode) mapNode.textContent = "";
  map = new google.maps.Map(mapNode, {
    center,
    zoom: DEFAULT_MAP_ZOOM,
    mapId: "ecotrace-action-map",
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeControl: false,
  });
  infoWindow = new google.maps.InfoWindow();
  userMarker = new google.maps.Marker({
    map,
    position: center,
    title: "Your location",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "#2f7c64",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: USER_MARKER_STROKE_WEIGHT,
      scale: USER_MARKER_SCALE,
    },
  });
  const groups = await Promise.all(
    Object.keys(CATEGORY_META).map((category) =>
      fetchPlacesForCategory(category, center, map),
    ),
  );
  const ctx = getCtx();
  renderedSpots = renderSpotResults(
    ctx,
    groups.flat(),
    `Found ${groups.flat().length} green spots near you.`,
  );
  markers = ctx.markers;
}

/**
 * Handles a map search when no Maps API key is configured (demo mode).
 * Looks up the query in the fallback location dictionary, runs a fallback
 * search, and renders the results.
 * @param {string} query    - User search text.
 * @param {string} category - Category filter key.
 */
function handleDemoSearch(query, category) {
  const location = getLocationFallback(query);
  const spots = searchFallback(
    query, category, location || userPosition,
    { treatAsLocation: Boolean(location) || !hasGreenIntent(query) },
  );
  const ctx = getCtx();
  renderedSpots = renderSpotResults(
    ctx,
    spots,
    spots.length
      ? `Found ${spots.length} demo green spots.`
      : "No demo matches found.",
  );
  markers = ctx.markers;
}

/**
 * Processes live Places API search results: merges with fallback data when
 * the API returns nothing, updates markers, and toasts the user.
 * @param {object[]} spots             - Spots returned by the Places API.
 * @param {string}   query             - Original user search text.
 * @param {string}   effectiveCategory - Resolved category key.
 * @param {string}   searchLabel       - Human-readable location label.
 * @param {{ lat: number, lng: number }|null} resolvedLocation - Geocoded location, if any.
 */
function handleLiveSearchResults(spots, query, effectiveCategory, searchLabel, resolvedLocation) {
  const fallbackCenter = resolvedLocation || userPosition;
  const fallback = spots.length
    ? spots
    : searchFallback(
        query, effectiveCategory, fallbackCenter,
        { treatAsLocation: Boolean(resolvedLocation) || !hasGreenIntent(query) },
      );
  const categoryLabel = effectiveCategory === "all"
    ? "green spot"
    : CATEGORY_META[effectiveCategory].label.toLowerCase();
  const ctx = getCtx();
  renderedSpots = renderSpotResults(
    ctx,
    fallback,
    fallback.length
      ? `Found ${fallback.length} ${categoryLabel} results near ${searchLabel}.`
      : "No matching green spots found.",
  );
  markers = ctx.markers;
  setActiveCategory(effectiveCategory);
  showToast(
    fallback.length ? "Map search updated." : "No matching green spots found.",
    fallback.length ? "success" : "error",
  );
}

/**
 * Handles errors thrown during a map search by falling back to the demo
 * dataset and displaying a warning toast.
 * @param {Error}  error    - The caught error.
 * @param {string} query    - Original user search text.
 * @param {string} category - Category filter key.
 */
function handleSearchError(error, query, category) {
  logWarn('map', error);
  const location = getLocationFallback(query)
    || getLocationFallback(stripGreenServiceWords(query));
  const spots = searchFallback(
    query, category, location || userPosition,
    { treatAsLocation: Boolean(location) || !hasGreenIntent(query) },
  );
  const ctx = getCtx();
  renderedSpots = renderSpotResults(
    ctx,
    spots,
    spots.length
      ? `Showing ${spots.length} fallback search results.`
      : "Search failed and no fallback matches were found.",
  );
  markers = ctx.markers;
  showToast("Map search used fallback results.", "error");
}

/**
 * Orchestrates a full map search: resolves the location, queries the
 * Places API (or falls back to demo data), and updates the map + sidebar.
 * @param {string}                query              - User search text.
 * @param {string}                [category="all"]    - Category filter.
 * @param {HTMLButtonElement|null} [submitter=null]   - Submit button (for busy state).
 */
async function runMapSearch(query, category = "all", submitter = null) {
  if (!query && category === "all") {
    showToast("Enter a place or choose a green spot category to search.", "error");
    return;
  }
  if (submitter) setButtonBusy(submitter, true, "Searching...");
  try {
    if (!hasMapsConfig()) {
      handleDemoSearch(query, category);
      return;
    }
    await loadMapsScript();
    if (!map) await renderMap(userPosition);

    const effectiveCategory =
      category === "all" && hasGreenIntent(query)
        ? inferCategoryFromText(query)
        : category;
    const cleanedLocationQuery = stripGreenServiceWords(query);
    const resolvedLocation = await resolveLocation(query, cleanedLocationQuery);
    if (resolvedLocation && !hasGreenIntent(query)) {
      await renderMap({ lat: resolvedLocation.lat, lng: resolvedLocation.lng });
      setActiveCategory(effectiveCategory);
      const label = effectiveCategory === "all"
        ? "green spots"
        : CATEGORY_META[effectiveCategory].label.toLowerCase();
      setStatus(`Showing ${label} near ${resolvedLocation.label}.`);
      showToast("Map search updated.");
      return;
    }

    const searchCenter = resolvedLocation || userPosition;
    const searchLabel =
      resolvedLocation?.label || cleanedLocationQuery || query || "your map area";
    const apiSpots = await searchPlaces(searchLabel, effectiveCategory, searchCenter, map);
    handleLiveSearchResults(apiSpots, query, effectiveCategory, searchLabel, resolvedLocation);
  } catch (error) {
    handleSearchError(error, query, category);
  } finally {
    if (submitter) setButtonBusy(submitter, false);
  }
}

searchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(searchForm);
  const query = String(data.get("query") || "").trim();
  const category = String(data.get("category") || "all");
  const submitter = event.submitter || searchForm.querySelector("button[type='submit']");
  await runMapSearch(query, category, submitter);
});

findButton?.addEventListener("click", async () => {
  setButtonBusy(findButton, true, "Locating...");
  try {
    const position = await getCurrentPosition();
    await renderMap(position);
    showToast("Green spots updated near your location.");
  } catch (error) {
    logWarn('map', error);
    await renderMap(userPosition);
    showToast(
      "Location permission was unavailable, so EcoTrace used the default city view.",
      "error",
    );
  } finally {
    setButtonBusy(findButton, false);
  }
});

/**
 * Creates (or re-creates) the Google Maps instance at the default user
 * position and returns it once fully rendered.
 * @returns {Promise<void>} Resolves after the default map has been rendered.
 */
async function createMapInstance() {
  await renderMap(userPosition);
}

/**
 * Attaches click listeners to every category-filter button so toggling a
 * button adds/removes the category from the active set.
 * @returns {void}
 */
function addCategoryListeners() {
  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.mapFilter;
      if (activeCategories.has(category)) activeCategories.delete(category);
      else activeCategories.add(category);
      if (!activeCategories.size) activeCategories = new Set(Object.keys(CATEGORY_META));
      updateFilterButtons();
      syncMarkerVisibility(map, markers, renderedSpots, activeCategories);
    });
  });
}

/**
 * Pre-fills the search form with URL query-parameters (`place`, `q`,
 * `category`) and wires up the form's submit event to `runMapSearch`.
 * @returns {{ query: string, category: string }} Parsed query parameters.
 */
function setupSearchIntegration() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("place") || params.get("q") || "";
  const category = params.get("category") || "all";
  if (searchForm) {
    searchForm.elements.query.value = query;
    searchForm.elements.category.value =
      CATEGORY_META[category] || category === "all" ? category : "all";
  }
  return { query, category };
}

/**
 * Executes an initial map search when URL parameters request a specific
 * place or category so the page loads with relevant markers already shown.
 * @param {string} query    - The search text from URL params.
 * @param {string} category - The category key from URL params.
 * @returns {Promise<void>} Resolves after the search completes (or skips).
 */
async function loadInitialMarkers(query, category) {
  if (query || category !== "all") {
    await runMapSearch(query, category);
  }
}

/**
 * Entry point for the map page — creates the map, wires up category
 * filters and search integration, then loads initial markers from URL params.
 * @returns {Promise<void>} Resolves when the page is fully initialised.
 */
async function initMapPage() {
  await createMapInstance();
  addCategoryListeners();
  const { query, category } = setupSearchIntegration();
  await loadInitialMarkers(query, category);
}

initMapPage().catch((error) => {
  logError('map', error);
  setStatus("The map could not load. Showing fallback green spots.");
  renderedSpots = fallbackSpots(userPosition);
  renderList(renderedSpots, activeCategories);
});
