/**
 * @module map-search-ui
 * @description Pure helper functions, constants, and fallback data utilities
 * extracted from the map-search module. Includes category inference, distance
 * calculation, query normalisation, green-intent detection, location fallback
 * look-ups, and demo-data generation.
 */
import { MAP_FALLBACK_SPOTS } from "./data.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Mean radius of the Earth in kilometres (for Haversine formula). */
const EARTH_RADIUS_KM = 6371;

/** @type {string[]} Keywords that signal eco/green search intent. */
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

/** @type {Record<string, { lat: number, lng: number, label: string }>} */
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
