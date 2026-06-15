/**
 * @module map-helpers
 * @description Constants and utility helpers extracted from the core map
 * module. Contains default coordinates, zoom levels, marker styling, and
 * the dynamic Google Maps SDK loader.
 */
import { ECO_CONFIG } from "./config.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Default map centre latitude (New Delhi). */
export const DEFAULT_LAT = 28.6139;

/** Default map centre longitude (New Delhi). */
export const DEFAULT_LNG = 77.209;

/** Default zoom level for the initial map render. */
export const DEFAULT_MAP_ZOOM = 13;

/** Scale factor for the user-location marker circle. */
export const USER_MARKER_SCALE = 8;

/** Stroke weight for the user-location marker border. */
export const USER_MARKER_STROKE_WEIGHT = 3;

/* ── SDK loader ─────────────────────────────────────────────────── */

/**
 * Dynamically loads the Google Maps JavaScript SDK if not already present.
 * @returns {Promise<void>} Resolves when the SDK is available.
 */
export function loadMapsScript() {
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
