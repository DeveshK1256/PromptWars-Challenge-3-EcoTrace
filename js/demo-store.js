/**
 * @module demo-store
 * @description Demo-mode (offline / localStorage) storage layer for EcoTrace.
 * Provides account management, profile CRUD, footprint seeding, and activity
 * logging — all backed by localStorage — so the app works without Firebase.
 */
import { logWarn } from "./logger.js";

/* ── Named constants ───────────────────────────────────────────────── */

/** Maximum number of footprint records kept per user. */
export const MAX_FOOTPRINT_RECORDS = 24;

/** Maximum number of activity entries kept in demo mode. */
const MAX_ACTIVITY_ENTRIES = 20;

/** Default display name for new users. */
export const DEFAULT_DISPLAY_NAME = "EcoTracer";

/** Default demo guest display name. */
const DEFAULT_DEMO_GUEST_NAME = "Eco Guest";

/** Default demo guest email. */
const DEFAULT_DEMO_EMAIL = "demo@ecotrace.local";

/** Default demo green-points value. */
const DEFAULT_DEMO_GREEN_POINTS = 125;

/** Default demo CO₂ saved value. */
const DEFAULT_DEMO_CO2_SAVED = 340;

/** Default demo challenges completed. */
const DEFAULT_DEMO_CHALLENGES = 2;

/** Default demo streak value. */
const DEFAULT_DEMO_STREAK = 5;

/** Hash multiplier used in the fallback (non-SubtleCrypto) hashing algorithm. */
const HASH_MULTIPLIER = 31;

export const STORAGE_KEYS = Object.freeze({
  profile: "ecotrace.profile",
  footprints: "ecotrace.footprints",
  activities: "ecotrace.activities",
  demoAccounts: "ecotrace.demoAccounts",
});

export const DEMO_UID = "demo-user";
export const DEFAULT_PROFILE = Object.freeze({
  uid: DEMO_UID,
  displayName: DEFAULT_DEMO_GUEST_NAME,
  email: DEFAULT_DEMO_EMAIL,
  photoURL: "",
  greenPoints: DEFAULT_DEMO_GREEN_POINTS,
  co2Saved: DEFAULT_DEMO_CO2_SAVED,
  challengesCompleted: DEFAULT_DEMO_CHALLENGES,
  completedTips: [],
  acceptedChallenges: ["unplug-devices"],
  readArticles: [],
  badgesEarned: ["seedling", "starter"],
  streak: DEFAULT_DEMO_STREAK,
  isDemo: true,
});

/* ── localStorage helpers ──────────────────────────────────────────── */

/**
 * Reads and parses a JSON value from localStorage.
 * @param {string} key - The localStorage key.
 * @param {*} fallback - Value returned when the key is missing or unparseable.
 * @returns {*} The parsed value or the fallback.
 */
export function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    logWarn('demo-store', "Could not read ${key}", error);
    return fallback;
  }
}

/**
 * Serialises a value to JSON and writes it to localStorage.
 * @param {string} key - The localStorage key.
 * @param {*} value - The value to serialise.
 */
export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ── Email / auth utilities ────────────────────────────────────────── */

/**
 * Normalises an email address to a lower-case, trimmed string.
 * @param {string} email - The raw email address.
 * @returns {string} Normalised email.
 */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Creates an Error object with a Firebase-style `.code` property.
 * @param {string} code - The error code (e.g. "auth/wrong-password").
 * @param {string} message - Human-readable error message.
 * @returns {Error} The decorated Error instance.
 */
export function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Hashes a demo-mode password using SHA-256 (Web Crypto) or a simple
 * numeric fallback when SubtleCrypto is unavailable.
 * @param {string} email - User email (used as a salt).
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Hex-encoded hash string.
 */
export async function hashDemoPassword(email, password) {
  const value = `${normalizeEmail(email)}:${String(password || "")}`;
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * HASH_MULTIPLIER + value.charCodeAt(index)) >>> 0;
  }
  return `fallback-${hash.toString(16)}`;
}

/* ── Demo account management ───────────────────────────────────────── */

/**
 * Reads the map of demo accounts from localStorage.
 * @returns {Object<string, Object>} Account map keyed by normalised email.
 */
export function readDemoAccounts() {
  return readJson(STORAGE_KEYS.demoAccounts, {});
}

/**
 * Persists the demo accounts map to localStorage.
 * @param {Object<string, Object>} accounts - Account map to save.
 */
export function writeDemoAccounts(accounts) {
  writeJson(STORAGE_KEYS.demoAccounts, accounts);
}

/**
 * Creates a sanitised snapshot of a demo profile with guaranteed field types.
 * @param {Object} profile - Raw profile data.
 * @returns {Object} Clean profile snapshot.
 */
export function demoProfileSnapshot(profile) {
  return {
    displayName: profile.displayName || DEFAULT_DISPLAY_NAME,
    email: normalizeEmail(profile.email),
    photoURL: profile.photoURL || "",
    greenPoints: Number(profile.greenPoints || 0),
    co2Saved: Number(profile.co2Saved || 0),
    challengesCompleted: Number(profile.challengesCompleted || 0),
    completedTips: Array.isArray(profile.completedTips) ? profile.completedTips : [],
    acceptedChallenges: Array.isArray(profile.acceptedChallenges) ? profile.acceptedChallenges : [],
    readArticles: Array.isArray(profile.readArticles) ? profile.readArticles : [],
    badgesEarned: Array.isArray(profile.badgesEarned) ? profile.badgesEarned : [],
    streak: Number(profile.streak || 0),
  };
}

/**
 * Creates a fresh demo-mode account profile with zeroed stats.
 * @param {string} email - The account email.
 * @param {string} displayName - The account display name.
 * @returns {Object} New profile snapshot.
 */
export function createDemoAccountProfile(email, displayName) {
  return demoProfileSnapshot({
    displayName,
    email,
    photoURL: "",
    greenPoints: 0,
    co2Saved: 0,
    challengesCompleted: 0,
    completedTips: [],
    acceptedChallenges: [],
    readArticles: [],
    badgesEarned: [],
    streak: 0,
  });
}

/* ── Activity logging ──────────────────────────────────────────────── */

/**
 * Prepends an activity log entry to local storage (demo mode).
 * @param {string} message - Human-readable activity description.
 * @param {string} [type="info"] - Activity type tag (e.g. "auth", "points").
 */
export function addActivity(message, type = "info") {
  const activities = readJson(STORAGE_KEYS.activities, []);
  activities.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    message,
    type,
    createdAt: new Date().toISOString(),
  });
  writeJson(STORAGE_KEYS.activities, activities.slice(0, MAX_ACTIVITY_ENTRIES));
}

/* ── Demo profile CRUD ─────────────────────────────────────────────── */

/**
 * Retrieves (or initialises) the current demo-mode profile from localStorage.
 * @returns {Object} The demo user profile with `isDemo: true`.
 */
export function getDemoProfile() {
  const stored = readJson(STORAGE_KEYS.profile, null);
  if (stored) return { ...DEFAULT_PROFILE, ...stored, isDemo: true };
  writeJson(STORAGE_KEYS.profile, DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE };
}

/**
 * Merges updates into the demo profile and persists to localStorage.
 * Also updates the matching demo-account record if one exists.
 * @param {Object} nextProfile - Partial profile fields to merge.
 * @returns {Object} The merged and persisted profile.
 */
export function saveDemoProfile(nextProfile) {
  const profile = { ...getDemoProfile(), ...nextProfile, uid: DEMO_UID, isDemo: true };
  writeJson(STORAGE_KEYS.profile, profile);
  const accounts = readDemoAccounts();
  const accountKey = normalizeEmail(profile.email);
  if (accountKey && accounts[accountKey]) {
    accounts[accountKey] = {
      ...accounts[accountKey],
      displayName: profile.displayName,
      photoURL: profile.photoURL || "",
      profile: demoProfileSnapshot(profile),
      updatedAt: new Date().toISOString(),
    };
    writeDemoAccounts(accounts);
  }
  return profile;
}

/* ── Seed / footprint data ─────────────────────────────────────────── */

/**
 * Returns an ISO date string for `index` months before the current date.
 * @param {number} index - Number of months to subtract.
 * @returns {string} ISO 8601 date string.
 */
function monthAgo(index) {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return date.toISOString();
}

/**
 * Generates six seed footprint records spanning the last five months.
 * @returns {Array<Object>} Array of footprint record objects.
 */
export function seedFootprints() {
  return [
    {
      id: "seed-0",
      totalKg: 2870,
      date: monthAgo(5),
      breakdown: { transport: 850, food: 820, energy: 720, shopping: 480 },
      formData: {},
    },
    {
      id: "seed-1",
      totalKg: 2680,
      date: monthAgo(4),
      breakdown: { transport: 790, food: 780, energy: 680, shopping: 430 },
      formData: {},
    },
    {
      id: "seed-2",
      totalKg: 2490,
      date: monthAgo(3),
      breakdown: { transport: 710, food: 760, energy: 630, shopping: 390 },
      formData: {},
    },
    {
      id: "seed-3",
      totalKg: 2320,
      date: monthAgo(2),
      breakdown: { transport: 640, food: 720, energy: 590, shopping: 370 },
      formData: {},
    },
    {
      id: "seed-4",
      totalKg: 2195,
      date: monthAgo(1),
      breakdown: { transport: 590, food: 690, energy: 565, shopping: 350 },
      formData: {},
    },
    {
      id: "seed-5",
      totalKg: 2040,
      date: new Date().toISOString(),
      breakdown: { transport: 520, food: 650, energy: 535, shopping: 335 },
      formData: {},
    },
  ];
}

/**
 * Reads footprints from localStorage, seeding defaults on first access.
 * @returns {Array<Object>} Array of footprint records.
 */
export function getLocalFootprints() {
  const existing = readJson(STORAGE_KEYS.footprints, null);
  if (existing && existing.length) return existing;
  const seeded = seedFootprints();
  writeJson(STORAGE_KEYS.footprints, seeded);
  return seeded;
}
