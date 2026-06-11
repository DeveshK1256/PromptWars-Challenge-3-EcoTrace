/**
 * @module map
 * @description Interactive green-spots map page for EcoTrace. Handles Google
 * Maps initialisation, marker management, category filtering, and a
 * comprehensive fallback dataset when API keys are unavailable. Search,
 * geocoding, and Places-API logic live in the companion `map-search` module.
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

/* ── Magic-number constants ─────────────────────────────────────── */

/** Default map centre latitude (New Delhi). */
const DEFAULT_LAT = 28.6139;

/** Default map centre longitude (New Delhi). */
const DEFAULT_LNG = 77.209;

/** Zoom level used when the map focuses on a single spot. */
const SINGLE_SPOT_ZOOM = 14;

/** Default zoom level for the initial map render. */
const DEFAULT_MAP_ZOOM = 13;

/** Padding in pixels applied when fitting bounds around multiple spots. */
const FIT_BOUNDS_PADDING_PX = 64;

/** Scale factor for the user-location marker circle. */
const USER_MARKER_SCALE = 8;

/** Stroke weight for the user-location marker border. */
const USER_MARKER_STROKE_WEIGHT = 3;

const mapNode = document.getElementById("ecoMap");
const listNode = document.querySelector("[data-map-list]");
const statusNode = document.querySelector("[data-map-status]");
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
 * Updates the map status text element.
 * @param {string} message - Status text to display.
 */
function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
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
  syncMarkerVisibility();
}

/**
 * Renders the sidebar list of visible green spots, filtered by active categories.
 */
function renderList() {
  if (!listNode) return;
  listNode.replaceChildren();
  const visible = renderedSpots.filter((spot) => activeCategories.has(spot.category));
  if (!visible.length) {
    const item = document.createElement("li");
    item.className = "map-result";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "No matching green spots yet";
    const text = document.createElement("p");
    text.textContent = "Try a broader search term or enable more marker filters.";
    body.append(title, text);
    item.append(body);
    listNode.append(item);
    return;
  }
  visible.forEach((spot) => {
    const item = document.createElement("li");
    item.className = "map-result";
    const icon = document.createElement("span");
    icon.className = "map-result-icon";
    icon.textContent = CATEGORY_META[spot.category]?.icon || "•";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = spot.name;
    const address = document.createElement("p");
    address.textContent =
      `${spot.address || "Address available on map"}` +
      ` • ${spot.distanceKm.toFixed(1)} km away`;
    body.append(title, address);
    item.append(icon, body);
    listNode.append(item);
  });
}

/**
 * Shows or hides map markers based on the current `activeCategories` set,
 * then refreshes the sidebar list.
 */
function syncMarkerVisibility() {
  markers.forEach(({ marker, category }) => {
    marker.setMap(map && activeCategories.has(category) ? map : null);
  });
  renderList();
}

/**
 * Removes all green-spot markers from the map and empties the array.
 */
function clearSpotMarkers() {
  markers.forEach(({ marker }) => marker.setMap(null));
  markers = [];
}

/**
 * Creates a Google Maps marker for a single green spot and registers a
 * click handler that opens an info-window.
 * @param {object} spot - The green-spot data object.
 */
function addMarker(spot) {
  if (!map || !window.google?.maps) return;
  const marker = new google.maps.Marker({
    map,
    position: { lat: spot.lat, lng: spot.lng },
    title: spot.name,
    label: CATEGORY_META[spot.category]?.icon,
  });
  marker.addListener("click", () => {
    infoWindow.setContent(
      `<strong>${spot.name}</strong><br>` +
      `${spot.address || "Address unavailable"}<br>` +
      `${spot.distanceKm.toFixed(1)} km away`,
    );
    infoWindow.open({ map, anchor: marker });
  });
  markers.push({ marker, category: spot.category });
}

/**
 * Adjusts the map viewport to contain all provided spots.
 * @param {object[]} spots - Array of spot objects with `lat` and `lng`.
 */
function fitMapToSpots(spots) {
  if (!map || !window.google?.maps || !spots.length) return;
  if (spots.length === 1) {
    map.setCenter({ lat: spots[0].lat, lng: spots[0].lng });
    map.setZoom(SINGLE_SPOT_ZOOM);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  spots.forEach((spot) => bounds.extend({ lat: spot.lat, lng: spot.lng }));
  map.fitBounds(bounds, FIT_BOUNDS_PADDING_PX);
}

/**
 * Replaces the current map spots with a new set, sorts by distance, adds
 * markers, fits the viewport, and updates the status text.
 * @param {object[]} spots      - New spot data.
 * @param {string}   statusText - Status message to display.
 */
function renderSpotResults(spots, statusText) {
  clearSpotMarkers();
  renderedSpots = spots.sort((a, b) => a.distanceKm - b.distanceKm);
  renderedSpots.forEach(addMarker);
  fitMapToSpots(renderedSpots);
  syncMarkerVisibility();
  setStatus(statusText);
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
  clearSpotMarkers();
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
    renderList();
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
  renderSpotResults(
    groups.flat(),
    `Found ${groups.flat().length} green spots near you.`,
  );
}

/* ── Event listeners ────────────────────────────────────────────── */

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.mapFilter;
    if (activeCategories.has(category)) activeCategories.delete(category);
    else activeCategories.add(category);
    if (!activeCategories.size) activeCategories = new Set(Object.keys(CATEGORY_META));
    updateFilterButtons();
    syncMarkerVisibility();
  });
});

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
      const location = getLocationFallback(query);
      const spots = searchFallback(
        query, category, location || userPosition,
        { treatAsLocation: Boolean(location) || !hasGreenIntent(query) },
      );
      renderSpotResults(
        spots,
        spots.length
          ? `Found ${spots.length} demo green spots.`
          : "No demo matches found.",
      );
      return;
    }
    await loadMapsScript();
    if (!map) await renderMap(userPosition);

    const effectiveCategory = category === "all" && hasGreenIntent(query) ? inferCategoryFromText(query) : category;
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
    const searchLabel = resolvedLocation?.label || cleanedLocationQuery || query || "your map area";
    const spots = await searchPlaces(searchLabel, effectiveCategory, searchCenter, map);
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
    renderSpotResults(
      fallback,
      fallback.length
        ? `Found ${fallback.length} ${categoryLabel} results near ${searchLabel}.`
        : "No matching green spots found.",
    );
    setActiveCategory(effectiveCategory);
    showToast(
      fallback.length ? "Map search updated." : "No matching green spots found.",
      fallback.length ? "success" : "error",
    );
  } catch (error) {
    logWarn('map', error);
    const location = getLocationFallback(query) || getLocationFallback(stripGreenServiceWords(query));
    const spots = searchFallback(
      query, category, location || userPosition,
      { treatAsLocation: Boolean(location) || !hasGreenIntent(query) },
    );
    renderSpotResults(
      spots,
      spots.length
        ? `Showing ${spots.length} fallback search results.`
        : "Search failed and no fallback matches were found.",
    );
    showToast("Map search used fallback results.", "error");
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
 * Entry point for the map page — renders the default map, then checks URL
 * query-parameters for an initial search to execute.
 */
async function initMapPage() {
  await renderMap(userPosition);
  const params = new URLSearchParams(window.location.search);
  const query = params.get("place") || params.get("q") || "";
  const category = params.get("category") || "all";
  if (query || category !== "all") {
    if (searchForm) {
      searchForm.elements.query.value = query;
      searchForm.elements.category.value = CATEGORY_META[category] || category === "all" ? category : "all";
    }
    await runMapSearch(query, category);
  }
}

initMapPage().catch((error) => {
  logError('map', error);
  setStatus("The map could not load. Showing fallback green spots.");
  renderedSpots = fallbackSpots(userPosition);
  renderList();
});
