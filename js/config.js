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

export function hasFirebaseConfig() {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return required.every((key) => Boolean(ECO_CONFIG.firebase[key]));
}

export function hasMapsConfig() {
  return Boolean(ECO_CONFIG.google.mapsApiKey || ECO_CONFIG.google.placesApiKey);
}

export function hasSearchConfig() {
  return Boolean(ECO_CONFIG.google.customSearchApiKey && ECO_CONFIG.google.customSearchCx);
}

export function hasGeminiConfig() {
  return Boolean(ECO_CONFIG.gemini.proxyEndpoint || ECO_CONFIG.gemini.apiKey);
}
