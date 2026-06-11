import { ECO_CONFIG, hasMapsConfig } from "./config.js?v=firebase-config-28";
import { MAP_FALLBACK_SPOTS } from "./data.js?v=firebase-config-28";
import { setButtonBusy, showToast } from "./app.js?v=firebase-config-28";

const CATEGORY_META = {
  ev: { label: "EV Charging", icon: "🔌", keyword: "EV charging station" },
  recycling: { label: "Recycling", icon: "♻️", keyword: "recycling center" },
  trees: { label: "Tree Events", icon: "🌳", keyword: "tree plantation event" },
  organic: { label: "Organic Markets", icon: "🥦", keyword: "organic market" },
};

const GREEN_QUERY_TERMS = [
  "ev",
  "charg",
  "recycl",
  "scrap",
  "tree",
  "plant",
  "organic",
  "market",
  "farm",
  "compost",
  "solar",
  "green",
];

const LOCATION_FALLBACKS = {
  india: { lat: 22.9734, lng: 78.6569, label: "India" },
  bharat: { lat: 22.9734, lng: 78.6569, label: "India" },
  delhi: { lat: 28.6139, lng: 77.209, label: "Delhi" },
  "new delhi": { lat: 28.6139, lng: 77.209, label: "New Delhi" },
  maharashtra: { lat: 19.7515, lng: 75.7139, label: "Maharashtra" },
  mumbai: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
  karnataka: { lat: 15.3173, lng: 75.7139, label: "Karnataka" },
  bengaluru: { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
  bangalore: { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
  "tamil nadu": { lat: 11.1271, lng: 78.6569, label: "Tamil Nadu" },
  tamilnadu: { lat: 11.1271, lng: 78.6569, label: "Tamil Nadu" },
  chennai: { lat: 13.0827, lng: 80.2707, label: "Chennai" },
  gujarat: { lat: 22.2587, lng: 71.1924, label: "Gujarat" },
  ahmedabad: { lat: 23.0225, lng: 72.5714, label: "Ahmedabad" },
  rajasthan: { lat: 27.0238, lng: 74.2179, label: "Rajasthan" },
  jaipur: { lat: 26.9124, lng: 75.7873, label: "Jaipur" },
  telangana: { lat: 18.1124, lng: 79.0193, label: "Telangana" },
  hyderabad: { lat: 17.385, lng: 78.4867, label: "Hyderabad" },
  kerala: { lat: 10.8505, lng: 76.2711, label: "Kerala" },
  kochi: { lat: 9.9312, lng: 76.2673, label: "Kochi" },
  "west bengal": { lat: 22.9868, lng: 87.855, label: "West Bengal" },
  kolkata: { lat: 22.5726, lng: 88.3639, label: "Kolkata" },
  "uttar pradesh": { lat: 26.8467, lng: 80.9462, label: "Uttar Pradesh" },
  lucknow: { lat: 26.8467, lng: 80.9462, label: "Lucknow" },
  usa: { lat: 39.8283, lng: -98.5795, label: "United States" },
  "united states": { lat: 39.8283, lng: -98.5795, label: "United States" },
  uk: { lat: 55.3781, lng: -3.436, label: "United Kingdom" },
  "united kingdom": { lat: 55.3781, lng: -3.436, label: "United Kingdom" },
  canada: { lat: 56.1304, lng: -106.3468, label: "Canada" },
  australia: { lat: -25.2744, lng: 133.7751, label: "Australia" },
};

const mapNode = document.getElementById("ecoMap");
const listNode = document.querySelector("[data-map-list]");
const statusNode = document.querySelector("[data-map-status]");
const findButton = document.querySelector("[data-find-green-spots]");
const searchForm = document.querySelector("[data-map-search-form]");
const filters = [...document.querySelectorAll("[data-map-filter]")];
let map;
let infoWindow;
let userMarker;
let userPosition = { lat: 28.6139, lng: 77.209 };
let activeCategories = new Set(Object.keys(CATEGORY_META));
let renderedSpots = [];
let markers = [];

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function loadMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  const key = ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

function fallbackSpots(center = userPosition) {
  return MAP_FALLBACK_SPOTS.map((spot) => ({
    ...spot,
    lat: center.lat + spot.latOffset,
    lng: center.lng + spot.lngOffset,
    distanceKm: distanceKm(center, { lat: center.lat + spot.latOffset, lng: center.lng + spot.lngOffset }),
  }));
}

function updateFilterButtons() {
  filters.forEach((filter) => {
    filter.setAttribute("aria-pressed", String(activeCategories.has(filter.dataset.mapFilter)));
  });
}

function setActiveCategory(category) {
  activeCategories = category === "all" ? new Set(Object.keys(CATEGORY_META)) : new Set([category]);
  updateFilterButtons();
  syncMarkerVisibility();
}

function inferCategoryFromText(text = "") {
  const value = text.toLowerCase();
  if (value.includes("ev") || value.includes("charg")) return "ev";
  if (value.includes("recycl") || value.includes("scrap")) return "recycling";
  if (value.includes("tree") || value.includes("plant") || value.includes("park")) return "trees";
  if (value.includes("organic") || value.includes("market") || value.includes("farm")) return "organic";
  return "trees";
}

function normalizePlaceKey(query = "") {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function hasGreenIntent(query = "") {
  const value = normalizePlaceKey(query);
  return GREEN_QUERY_TERMS.some((term) => value.includes(term));
}

function getLocationFallback(query = "") {
  const normalized = normalizePlaceKey(query);
  if (!normalized) return null;
  if (LOCATION_FALLBACKS[normalized]) return LOCATION_FALLBACKS[normalized];
  const matchingKey = Object.keys(LOCATION_FALLBACKS).find((key) => normalized.includes(key) || key.includes(normalized));
  return matchingKey ? LOCATION_FALLBACKS[matchingKey] : null;
}

function stripGreenServiceWords(query = "") {
  return query
    .replace(
      /\b(find|show|near|nearby|around|in|green|spot|spots|eco|ev|electric|charging|charger|chargers|station|stations|recycling|recycle|scrap|center|centers|centre|centres|tree|trees|plant|plants|plantation|event|events|organic|market|markets|farm|farms|compost|solar)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

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
    address.textContent = `${spot.address || "Address available on map"} • ${spot.distanceKm.toFixed(1)} km away`;
    body.append(title, address);
    item.append(icon, body);
    listNode.append(item);
  });
}

function syncMarkerVisibility() {
  markers.forEach(({ marker, category }) => {
    marker.setMap(map && activeCategories.has(category) ? map : null);
  });
  renderList();
}

function clearSpotMarkers() {
  markers.forEach(({ marker }) => marker.setMap(null));
  markers = [];
}

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
      `<strong>${spot.name}</strong><br>${spot.address || "Address unavailable"}<br>${spot.distanceKm.toFixed(1)} km away`,
    );
    infoWindow.open({ map, anchor: marker });
  });
  markers.push({ marker, category: spot.category });
}

function fitMapToSpots(spots) {
  if (!map || !window.google?.maps || !spots.length) return;
  if (spots.length === 1) {
    map.setCenter({ lat: spots[0].lat, lng: spots[0].lng });
    map.setZoom(14);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  spots.forEach((spot) => bounds.extend({ lat: spot.lat, lng: spot.lng }));
  map.fitBounds(bounds, 64);
}

function renderSpotResults(spots, statusText) {
  clearSpotMarkers();
  renderedSpots = spots.sort((a, b) => a.distanceKm - b.distanceKm);
  renderedSpots.forEach(addMarker);
  fitMapToSpots(renderedSpots);
  syncMarkerVisibility();
  setStatus(statusText);
}

async function fetchPlacesForCategory(category, center) {
  if (!window.google?.maps?.places || category === "trees") {
    return fallbackSpots(center).filter((spot) => spot.category === category);
  }
  const service = new google.maps.places.PlacesService(map);
  const keyword = CATEGORY_META[category].keyword;
  return new Promise((resolve) => {
    service.nearbySearch({ location: center, radius: 7000, keyword }, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve(fallbackSpots(center).filter((spot) => spot.category === category));
        return;
      }
      resolve(
        results.slice(0, 5).map((place) => {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          return {
            id: place.place_id,
            category,
            name: place.name,
            address: place.vicinity || "Address available on Google Maps",
            lat,
            lng,
            distanceKm: distanceKm(center, { lat, lng }),
          };
        }),
      );
    });
  });
}

function geocodeAddress(query) {
  if (!window.google?.maps?.Geocoder || !query) return Promise.resolve(null);
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const location = results[0].geometry.location;
      resolve({
        lat: location.lat(),
        lng: location.lng(),
        label: results[0].formatted_address || query,
      });
    });
  });
}

async function geocodeWithGoogleRest(query) {
  const key = ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey;
  if (!key || !query) return null;
  const params = new URLSearchParams({ address: query, key });
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.results?.[0];
    if (data.status !== "OK" || !result?.geometry?.location) return null;
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      label: result.formatted_address || query,
    };
  } catch {
    return null;
  }
}

async function geocodeWithOpenStreetMap(query) {
  if (!query) return null;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data?.[0];
    if (!result?.lat || !result?.lon) return null;
    return {
      lat: Number(result.lat),
      lng: Number(result.lon),
      label: result.display_name || query,
    };
  } catch {
    return null;
  }
}

async function resolveLocation(query, cleanedLocationQuery = "") {
  const candidates = [query, cleanedLocationQuery].map((item) => item?.trim()).filter(Boolean);
  for (const candidate of candidates) {
    const fallback = getLocationFallback(candidate);
    const googleMaps = await geocodeAddress(candidate);
    const googleRest = googleMaps || (await geocodeWithGoogleRest(candidate));
    const openStreetMap = googleRest || (await geocodeWithOpenStreetMap(candidate));
    const resolved = openStreetMap || fallback;
    if (resolved) return resolved;
  }
  return null;
}

function searchPlaces(query, category, center) {
  if (!window.google?.maps?.places || !map) return Promise.resolve([]);
  const selectedCategory = category === "all" ? inferCategoryFromText(query) : category;
  const service = new google.maps.places.PlacesService(map);
  const searchQuery =
    category === "all"
      ? query
      : `${CATEGORY_META[selectedCategory].keyword} near ${query}`;
  return new Promise((resolve) => {
    service.textSearch({ query: searchQuery, location: center, radius: 10000 }, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(
        results.slice(0, 8).map((place) => {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const inferred = category === "all" ? inferCategoryFromText(`${place.name} ${place.types?.join(" ") || ""}`) : selectedCategory;
          return {
            id: place.place_id,
            category: inferred,
            name: place.name,
            address: place.formatted_address || place.vicinity || "Address available on Google Maps",
            lat,
            lng,
            distanceKm: distanceKm(center, { lat, lng }),
          };
        }),
      );
    });
  });
}

function searchFallback(query, category, center = userPosition, options = {}) {
  const needle = query.toLowerCase();
  const shouldTreatAsLocation = options.treatAsLocation || (needle && !hasGreenIntent(needle));
  const matches = fallbackSpots(center).filter((spot) => {
    const matchesCategory = category === "all" || spot.category === category;
    const haystack = `${spot.name} ${spot.address} ${CATEGORY_META[spot.category]?.label}`.toLowerCase();
    return matchesCategory && (!needle || shouldTreatAsLocation || haystack.includes(needle));
  });
  if (matches.length || !shouldTreatAsLocation) return matches;
  return fallbackSpots(center).filter((spot) => category === "all" || spot.category === category);
}

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
      mapNode.textContent = "Google Maps preview is in demo mode. Add a Maps API key in js/config.js for the live map.";
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
    zoom: 13,
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
      strokeWeight: 3,
      scale: 8,
    },
  });
  const groups = await Promise.all(Object.keys(CATEGORY_META).map((category) => fetchPlacesForCategory(category, center)));
  renderSpotResults(groups.flat(), `Found ${groups.flat().length} green spots near you.`);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  });
}

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

async function runMapSearch(query, category = "all", submitter = null) {
  if (!query && category === "all") {
    showToast("Enter a place or choose a green spot category to search.", "error");
    return;
  }
  if (submitter) setButtonBusy(submitter, true, "Searching...");
  try {
    if (!hasMapsConfig()) {
      const location = getLocationFallback(query);
      const spots = searchFallback(query, category, location || userPosition, { treatAsLocation: Boolean(location) || !hasGreenIntent(query) });
      renderSpotResults(spots, spots.length ? `Found ${spots.length} demo green spots.` : "No demo matches found.");
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
      const label = effectiveCategory === "all" ? "green spots" : CATEGORY_META[effectiveCategory].label.toLowerCase();
      setStatus(`Showing ${label} near ${resolvedLocation.label}.`);
      showToast("Map search updated.");
      return;
    }

    const searchCenter = resolvedLocation || userPosition;
    const searchLabel = resolvedLocation?.label || cleanedLocationQuery || query || "your map area";
    const spots = await searchPlaces(searchLabel, effectiveCategory, searchCenter);
    const fallbackCenter = resolvedLocation || userPosition;
    const fallback = spots.length
      ? spots
      : searchFallback(query, effectiveCategory, fallbackCenter, { treatAsLocation: Boolean(resolvedLocation) || !hasGreenIntent(query) });
    renderSpotResults(
      fallback,
      fallback.length
        ? `Found ${fallback.length} ${effectiveCategory === "all" ? "green spot" : CATEGORY_META[effectiveCategory].label.toLowerCase()} results near ${searchLabel}.`
        : "No matching green spots found.",
    );
    setActiveCategory(effectiveCategory);
    showToast(fallback.length ? "Map search updated." : "No matching green spots found.", fallback.length ? "success" : "error");
  } catch (error) {
    console.warn(error);
    const location = getLocationFallback(query) || getLocationFallback(stripGreenServiceWords(query));
    const spots = searchFallback(query, category, location || userPosition, { treatAsLocation: Boolean(location) || !hasGreenIntent(query) });
    renderSpotResults(spots, spots.length ? `Showing ${spots.length} fallback search results.` : "Search failed and no fallback matches were found.");
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
    console.warn(error);
    await renderMap(userPosition);
    showToast("Location permission was unavailable, so EcoTrace used the default city view.", "error");
  } finally {
    setButtonBusy(findButton, false);
  }
});

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
  console.error(error);
  setStatus("The map could not load. Showing fallback green spots.");
  renderedSpots = fallbackSpots(userPosition);
  renderList();
});
