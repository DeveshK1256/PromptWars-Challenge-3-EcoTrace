/**
 * @module map-search
 * @description Search, geocoding, geolocation, and Places-API helpers for the
 * EcoTrace green-spots map. Provides category inference, multi-provider
 * geocoding (Google Maps SDK → Google REST → OpenStreetMap → hard-coded
 * fallback), Google Places nearby/text search, and a comprehensive fallback
 * dataset when API keys are unavailable.
 */
import { ECO_CONFIG } from "./config.js";
import { MAP_FALLBACK_SPOTS } from "./data.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Mean radius of the Earth in kilometres (for Haversine formula). */
const EARTH_RADIUS_KM = 6371;

/** Search radius in metres for `nearbySearch` (Places API). */
const NEARBY_SEARCH_RADIUS_M = 7000;

/** Search radius in metres for `textSearch` (Places API). */
const TEXT_SEARCH_RADIUS_M = 10000;

/** Maximum results returned by a nearbySearch per category. */
const NEARBY_RESULTS_LIMIT = 5;

/** Maximum results returned by a textSearch. */
const TEXT_SEARCH_RESULTS_LIMIT = 8;

/** Geolocation API timeout in milliseconds. */
const GEOLOCATION_TIMEOUT_MS = 9000;

/** Geolocation API maximum cached position age in milliseconds. */
const GEOLOCATION_MAX_AGE_MS = 60000;

/** @type {Record<string, { label: string, icon: string, keyword: string }>} */
export const CATEGORY_META = {
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

/* ── Pure helpers ────────────────────────────────────────────────── */

/**
 * Calculates the great-circle distance between two lat/lng points using the
 * Haversine formula.
 * @param {{ lat: number, lng: number }} a - First coordinate.
 * @param {{ lat: number, lng: number }} b - Second coordinate.
 * @returns {number} Distance in kilometres.
 */
export function distanceKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Guesses the most relevant green-spot category from free-text input.
 * @param {string} [text=""] - User query or place name.
 * @returns {string} A category key ("ev", "recycling", "trees", or "organic").
 */
export function inferCategoryFromText(text = "") {
  const value = text.toLowerCase();
  if (value.includes("ev") || value.includes("charg")) return "ev";
  if (value.includes("recycl") || value.includes("scrap")) return "recycling";
  if (value.includes("tree") || value.includes("plant") || value.includes("park")) return "trees";
  if (value.includes("organic") || value.includes("market") || value.includes("farm")) return "organic";
  return "trees";
}

/**
 * Normalises a query string for dictionary look-up by lowering case and
 * collapsing non-alphanumeric characters to single spaces.
 * @param {string} [query=""] - Raw search input.
 * @returns {string} Cleaned key string.
 */
export function normalizePlaceKey(query = "") {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Determines whether a search query contains eco/green-service keywords.
 * @param {string} [query=""] - User search input.
 * @returns {boolean} `true` if the query has green intent.
 */
export function hasGreenIntent(query = "") {
  const value = normalizePlaceKey(query);
  return GREEN_QUERY_TERMS.some((term) => value.includes(term));
}

/**
 * Looks up a hard-coded lat/lng for well-known city or country names.
 * @param {string} [query=""] - Location search string.
 * @returns {{ lat: number, lng: number, label: string }|null} Matching fallback or null.
 */
export function getLocationFallback(query = "") {
  const normalized = normalizePlaceKey(query);
  if (!normalized) return null;
  if (LOCATION_FALLBACKS[normalized]) return LOCATION_FALLBACKS[normalized];
  const matchingKey = Object.keys(LOCATION_FALLBACKS).find(
    (key) => normalized.includes(key) || key.includes(normalized),
  );
  return matchingKey ? LOCATION_FALLBACKS[matchingKey] : null;
}

/**
 * Strips common eco/green service words from a query to isolate the
 * location portion (e.g. "EV charging near Mumbai" → "Mumbai").
 * @param {string} [query=""] - Raw user search string.
 * @returns {string} The query with service keywords removed.
 */
export function stripGreenServiceWords(query = "") {
  return query
    .replace(
      /\b(find|show|near|nearby|around|in|green|spot|spots|eco|ev|electric|charging|charger|chargers|station|stations|recycling|recycle|scrap|center|centers|centre|centres|tree|trees|plant|plants|plantation|event|events|organic|market|markets|farm|farms|compost|solar)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Fallback / demo data ───────────────────────────────────────── */

/**
 * Generates demo green-spot data centred around the given coordinate.
 * @param {{ lat: number, lng: number }} center - Origin point.
 * @returns {object[]} Array of spot objects with computed `lat`, `lng` and `distanceKm`.
 */
export function fallbackSpots(center) {
  return MAP_FALLBACK_SPOTS.map((spot) => ({
    ...spot,
    lat: center.lat + spot.latOffset,
    lng: center.lng + spot.lngOffset,
    distanceKm: distanceKm(center, {
      lat: center.lat + spot.latOffset,
      lng: center.lng + spot.lngOffset,
    }),
  }));
}

/* ── Geocoding providers ────────────────────────────────────────── */

/**
 * Geocodes an address string using the Google Maps Geocoder (client-side).
 * @param {string} query - Address or place name to geocode.
 * @returns {Promise<{ lat: number, lng: number, label: string }|null>}
 */
export function geocodeAddress(query) {
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

/**
 * Geocodes an address using the Google Geocoding REST API (server-key path).
 * @param {string} query - Address or place name to geocode.
 * @returns {Promise<{ lat: number, lng: number, label: string }|null>}
 */
export async function geocodeWithGoogleRest(query) {
  const key = ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey;
  if (!key || !query) return null;
  const params = new URLSearchParams({ address: query, key });
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    );
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

/**
 * Geocodes an address using the free OpenStreetMap Nominatim API.
 * @param {string} query - Address or place name to geocode.
 * @returns {Promise<{ lat: number, lng: number, label: string }|null>}
 */
export async function geocodeWithOpenStreetMap(query) {
  if (!query) return null;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  });
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
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

/**
 * Attempts to resolve a location from a query string using multiple
 * geocoding strategies in cascade: Google Maps SDK → Google REST →
 * OpenStreetMap → hard-coded fallback.
 * @param {string} query                       - Original user query.
 * @param {string} [cleanedLocationQuery=""]    - Query with green keywords stripped.
 * @returns {Promise<{ lat: number, lng: number, label: string }|null>}
 */
export async function resolveLocation(query, cleanedLocationQuery = "") {
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

/* ── Places search ──────────────────────────────────────────────── */

/**
 * Fetches nearby places for a single category via the Google Places API,
 * falling back to demo data when the API is unavailable.
 * @param {string} category                    - Category key (e.g. "ev").
 * @param {{ lat: number, lng: number }} center - Search origin.
 * @param {google.maps.Map} map                - Active Google Map instance.
 * @returns {Promise<object[]>} Array of spot objects.
 */
export async function fetchPlacesForCategory(category, center, map) {
  if (!window.google?.maps?.places || category === "trees") {
    return fallbackSpots(center).filter((spot) => spot.category === category);
  }
  const service = new google.maps.places.PlacesService(map);
  const keyword = CATEGORY_META[category].keyword;
  return new Promise((resolve) => {
    service.nearbySearch(
      { location: center, radius: NEARBY_SEARCH_RADIUS_M, keyword },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve(fallbackSpots(center).filter((spot) => spot.category === category));
          return;
        }
        resolve(
          results.slice(0, NEARBY_RESULTS_LIMIT).map((place) => {
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
      },
    );
  });
}

/**
 * Performs a Google Places text search for green spots matching the query.
 * @param {string} query                        - Search text.
 * @param {string} category                     - Category filter or "all".
 * @param {{ lat: number, lng: number }} center  - Search origin.
 * @param {google.maps.Map} map                 - Active Google Map instance.
 * @returns {Promise<object[]>} Array of matching spot objects.
 */
export function searchPlaces(query, category, center, map) {
  if (!window.google?.maps?.places || !map) return Promise.resolve([]);
  const selectedCategory = category === "all" ? inferCategoryFromText(query) : category;
  const service = new google.maps.places.PlacesService(map);
  const searchQuery =
    category === "all"
      ? query
      : `${CATEGORY_META[selectedCategory].keyword} near ${query}`;
  return new Promise((resolve) => {
    service.textSearch(
      { query: searchQuery, location: center, radius: TEXT_SEARCH_RADIUS_M },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve([]);
          return;
        }
        resolve(
          results.slice(0, TEXT_SEARCH_RESULTS_LIMIT).map((place) => {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const inferred = category === "all"
              ? inferCategoryFromText(`${place.name} ${place.types?.join(" ") || ""}`)
              : selectedCategory;
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
      },
    );
  });
}

/**
 * Searches the hard-coded fallback spots dataset when the Places API is
 * unavailable. Treats queries without green intent as pure location look-ups.
 * @param {string} query                        - User search string.
 * @param {string} category                     - Category filter or "all".
 * @param {{ lat: number, lng: number }} center  - Search origin.
 * @param {{ treatAsLocation?: boolean }}  [options={}] - Extra flags.
 * @returns {object[]} Matching fallback spots.
 */
export function searchFallback(query, category, center, options = {}) {
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

/* ── Geolocation ────────────────────────────────────────────────── */

/**
 * Prompts the user for their current geolocation via the browser API.
 * @returns {Promise<{ lat: number, lng: number }>} The user's coordinates.
 * @throws {Error} If geolocation is unavailable or the user denies access.
 */
export function getCurrentPosition() {
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
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: GEOLOCATION_MAX_AGE_MS,
      },
    );
  });
}
