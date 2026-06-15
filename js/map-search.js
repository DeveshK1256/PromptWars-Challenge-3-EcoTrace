/**
 * @module map-search
 * @description Search, geocoding, geolocation, and Places-API helpers for the
 * EcoTrace green-spots map. Provides category inference, multi-provider
 * geocoding (Google Maps SDK → Google REST → OpenStreetMap → hard-coded
 * fallback), Google Places nearby/text search, and a comprehensive fallback
 * dataset when API keys are unavailable.
 *
 * Pure helper functions and data constants are defined in the companion
 * {@link module:map-search-ui} module and re-exported here for backward
 * compatibility.
 */
import { ECO_CONFIG } from "./config.js";
import {
  distanceKm,
  inferCategoryFromText,
  normalizePlaceKey,
  hasGreenIntent,
  getLocationFallback,
  stripGreenServiceWords,
  fallbackSpots,
} from "./map-search-ui.js";

/* Re-export helpers so existing consumers keep working. */
export {
  distanceKm,
  inferCategoryFromText,
  normalizePlaceKey,
  hasGreenIntent,
  getLocationFallback,
  stripGreenServiceWords,
  fallbackSpots,
};

/* ── Magic-number constants ─────────────────────────────────────── */

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
