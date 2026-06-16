/**
 * @module config
 * Centralised configuration for the EcoTrace application.
 * Contains Firebase, Google Maps/Search, Gemini AI, and app-level
 * constants. All values are frozen at module load time.
 *
 * API keys are resolved at build time via `config.env.js`. During local
 * development the placeholders remain unreplaced and the hardcoded
 * fallback values below are used instead.
 */

import { ENV } from './config.env.js';

/**
 * Returns the build-time env value when it has been replaced by the build
 * script, otherwise falls back to the provided default.
 *
 * @param {string} envValue  - The placeholder (or replaced) value from ENV.
 * @param {string} defaultValue - Hardcoded fallback for local development.
 * @returns {string} The resolved configuration value.
 */
function envOrDefault(envValue, defaultValue) {
  return envValue && !envValue.startsWith('__') ? envValue : defaultValue;
}

/**
 * Application-wide configuration object.
 * Deeply frozen to prevent accidental mutation at runtime.
 *
 * @type {Readonly<{
 *   firebase: { apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string },
 *   google:   { mapsApiKey: string, placesApiKey: string, customSearchApiKey: string, customSearchCx: string },
 *   gemini:   { proxyEndpoint: string, apiKey: string, model: string },
 *   app:      { indiaAverageKg: number, worldAverageKg: number, cityAverageKg: number, kgPerTreePerYear: number }
 * }>}
 */
export const ECO_CONFIG = Object.freeze({
  firebase: {
    apiKey: envOrDefault(ENV.FIREBASE_API_KEY, "AIzaSyB8GMt2jIAZcn3r-mfQAT6I_vxS77AnJnk"),
    authDomain: envOrDefault(ENV.FIREBASE_AUTH_DOMAIN, "psyched-metrics-469316-u1.firebaseapp.com"),
    projectId: envOrDefault(ENV.FIREBASE_PROJECT_ID, "psyched-metrics-469316-u1"),
    storageBucket: envOrDefault(ENV.FIREBASE_STORAGE_BUCKET, "psyched-metrics-469316-u1.firebasestorage.app"),
    messagingSenderId: envOrDefault(ENV.FIREBASE_MESSAGING_SENDER_ID, "1034904942068"),
    appId: envOrDefault(ENV.FIREBASE_APP_ID, "1:1034904942068:web:380a4112d8ea683b5735a1"),
    recaptchaSiteKey: envOrDefault(ENV.RECAPTCHA_SITE_KEY, ''),
  },
  google: {
    mapsApiKey: envOrDefault(ENV.MAPS_API_KEY, "AIzaSyBZ67EkCb_bK6KsqJAZGOH1PbPE0sztYnI"),
    placesApiKey: envOrDefault(ENV.MAPS_API_KEY, "AIzaSyBZ67EkCb_bK6KsqJAZGOH1PbPE0sztYnI"),
    customSearchApiKey: envOrDefault(ENV.SEARCH_API_KEY, "AIzaSyDq6RlIaCJ-nRTt-NZ6JOejR0j_5OMFtao"),
    customSearchCx: envOrDefault(ENV.SEARCH_CX, "c4c9a158f97f447e0"),
  },
  gemini: {
    // Gemini requests go through a server-side proxy that holds the API key.
    // Never expose the Gemini key in client-side code.
    proxyEndpoint: envOrDefault(ENV.GEMINI_PROXY_ENDPOINT, ""),
    model: "gemini-2.0-flash-lite",
  },
  app: {
    indiaAverageKg: 1900,
    worldAverageKg: 4000,
    cityAverageKg: 1650,
    kgPerTreePerYear: 21.8,
  },
});

/**
 * Checks whether all required Firebase configuration keys are present.
 * Required keys: apiKey, authDomain, projectId, appId.
 *
 * @returns {boolean} `true` if every required Firebase key has a truthy value.
 */
export function hasFirebaseConfig() {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.every((key) => Boolean(ECO_CONFIG.firebase[key]));
}

/**
 * Checks whether a Google Maps or Places API key is configured.
 *
 * @returns {boolean} `true` if either `mapsApiKey` or `placesApiKey` is set.
 */
export function hasMapsConfig() {
  return Boolean(ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey);
}

/**
 * Checks whether both the Custom Search API key and search-engine ID are set.
 *
 * @returns {boolean} `true` if both `customSearchApiKey` and `customSearchCx` are truthy.
 */
export function hasSearchConfig() {
  return Boolean(ECO_CONFIG.google.customSearchApiKey && ECO_CONFIG.google.customSearchCx);
}

/**
 * Checks whether the Gemini AI integration is configured.
 * Accepts either a proxy endpoint or a direct API key.
 *
 * @returns {boolean} `true` if a proxy endpoint or API key is available.
 */
export function hasGeminiConfig() {
  return Boolean(ECO_CONFIG.gemini.proxyEndpoint);
}
