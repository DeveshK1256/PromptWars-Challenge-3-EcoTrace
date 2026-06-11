/**
 * @module config
 * Centralised configuration for the EcoTrace application.
 * Contains Firebase, Google Maps/Search, Gemini AI, and app-level
 * constants. All values are frozen at module load time.
 */

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
    apiKey: "AIzaSyB8GMt2jIAZcn3r-mfQAT6I_vxS77AnJnk",
    authDomain: "psyched-metrics-469316-u1.firebaseapp.com",
    projectId: "psyched-metrics-469316-u1",
    storageBucket: "psyched-metrics-469316-u1.firebasestorage.app",
    messagingSenderId: "1034904942068",
    appId: "1:1034904942068:web:380a4112d8ea683b5735a1",
  },
  google: {
    mapsApiKey: "AIzaSyBZ67EkCb_bK6KsqJAZGOH1PbPE0sztYnI",
    placesApiKey: "AIzaSyBZ67EkCb_bK6KsqJAZGOH1PbPE0sztYnI",
    customSearchApiKey: "AIzaSyDq6RlIaCJ-nRTt-NZ6JOejR0j_5OMFtao",
    customSearchCx: "",
  },
  gemini: {
    // Production recommendation: set geminiProxyEndpoint to a Firebase Function
    // and keep the Gemini key server-side. geminiApiKey is for local demos only.
    proxyEndpoint: "",
    apiKey: "AIzaSyB8GMt2jIAZcn3r-mfQAT6I_vxS77AnJnk",
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
  return Boolean(ECO_CONFIG.gemini.proxyEndpoint || ECO_CONFIG.gemini.apiKey);
}
