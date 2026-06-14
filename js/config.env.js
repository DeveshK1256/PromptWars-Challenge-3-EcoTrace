/**
 * @module config-env
 * Build-time environment variable injection.
 * During local dev, falls back to the existing hardcoded values.
 * In CI/production, these are replaced by the build script.
 */
export const ENV = Object.freeze({
  FIREBASE_API_KEY: '__FIREBASE_API_KEY__',
  FIREBASE_AUTH_DOMAIN: '__FIREBASE_AUTH_DOMAIN__',
  FIREBASE_PROJECT_ID: '__FIREBASE_PROJECT_ID__',
  FIREBASE_STORAGE_BUCKET: '__FIREBASE_STORAGE_BUCKET__',
  FIREBASE_MESSAGING_SENDER_ID: '__FIREBASE_MESSAGING_SENDER_ID__',
  FIREBASE_APP_ID: '__FIREBASE_APP_ID__',
  MAPS_API_KEY: '__MAPS_API_KEY__',
  GEMINI_API_KEY: '__GEMINI_API_KEY__',
  SEARCH_API_KEY: '__SEARCH_API_KEY__',
  SEARCH_CX: '__SEARCH_CX__',
  RECAPTCHA_SITE_KEY: '__RECAPTCHA_SITE_KEY__',
});
