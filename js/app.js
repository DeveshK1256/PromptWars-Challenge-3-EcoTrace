/**
 * @module app
 * @description Core application bootstrap for EcoTrace. Provides shared state,
 * utility helpers (formatting), auth flow, and core initialisation.
 * UI helpers (toasts, buttons, navigation, country-emissions table) are
 * delegated to the companion `app-ui` module and re-exported here so the
 * public API is unchanged.
 */
import { hasFirebaseConfig } from "./config.js";
import { BADGES } from "./data.js";
import { initAuthActions, updateAuthUI } from "./app-auth.js";
import {
  showToast,
  setButtonBusy,
  buildEmptyState,
  markActiveNav,
  initNavigation,
  initCarbonCounter,
  initCountryEmissions,
  initFooterYear,
  initReducedMotionToggle,
} from "./app-ui.js";

/* Re-export UI helpers so other modules can keep importing from "./app.js" */
export { showToast, setButtonBusy, buildEmptyState };

/* ── Magic-number constants ─────────────────────────────────────── */

/** Kilograms in one metric tonne. */
const KG_PER_TONNE = 1000;

/** Threshold (in kg) above which tonnes are shown with 0 decimal places. */
const LARGE_TONNE_THRESHOLD = 10000;

/** Delay (ms) before lazily loading the chatbot module. */
const CHATBOT_LAZY_DELAY_MS = 2000;

/**
 * Shared application state holding the current user, profile, and auth readiness.
 * @type {{ user: object|null, profile: object|null, authReady: boolean }}
 */
export const appState = {
  user: null,
  profile: null,
  authReady: false,
};

const userReadyHandlers = new Set();

/**
 * Formats a kilogram value for display, converting to tonnes when ≥ 1 000 kg.
 * @param {number} value - The kilogram value to format.
 * @returns {string} Formatted string like "1,234 kg" or "1.2T".
 */
export function formatKg(value) {
  const amount = Number(value) || 0;
  if (amount >= KG_PER_TONNE) {
    return `${(amount / KG_PER_TONNE).toFixed(amount >= LARGE_TONNE_THRESHOLD ? 0 : 1)}T`;
  }
  return `${Math.round(amount).toLocaleString()} kg`;
}

/**
 * Formats a date value into a human-readable "dd MMM yyyy" string (en-IN locale).
 * @param {string|number|Date|null} value - A value parseable by `new Date()`.
 * @returns {string} Formatted date string, or "Not recorded" if falsy.
 */
export function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Clamps a numeric value between a minimum and maximum (inclusive).
 * @param {number} value - The value to clamp.
 * @param {number} min   - Lower bound.
 * @param {number} max   - Upper bound.
 * @returns {number} The clamped value.
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns the IDs of all badges the user has earned at the given point total.
 * @param {number} [points=0] - The user's current green-point total.
 * @returns {string[]} Array of earned badge IDs.
 */
export function getBadgeIds(points = 0) {
  return BADGES.filter((badge) => points >= badge.threshold).map((badge) => badge.id);
}

/**
 * Registers a callback to run once authentication state is resolved.
 * If auth is already ready, the handler fires immediately.
 * @param {(user: object|null, profile: object|null) => void} handler - Callback receiving user & profile.
 * @returns {() => boolean} Unsubscribe function that removes the handler.
 */
export function onUserReady(handler) {
  userReadyHandlers.add(handler);
  if (appState.authReady) handler(appState.user, appState.profile);
  return () => userReadyHandlers.delete(handler);
}

/**
 * Redirects unauthenticated visitors away from pages marked
 * with `data-auth-required`, saving the intended destination for
 * post-login redirect.
 * @param {object|null} user - The current Firebase Auth user (or null).
 */
function enforceAuthGuard(user) {
  if (!document.body.matches("[data-auth-required]")) return;
  if (!hasFirebaseConfig()) return;
  if (user) return;
  sessionStorage.setItem(
    "ecotrace.returnTo",
    window.location.pathname.split("/").pop() || "dashboard.html",
  );
  window.location.href = "index.html?auth=required";
}

/**
 * Subscribes to Firebase Auth state changes. On each change it refreshes
 * `appState`, updates the UI, enforces auth-guards, and notifies all
 * registered `onUserReady` handlers.
 *
 * The first callback from `onAuthStateChanged` may fire with `null`
 * while Firebase restores a persisted session. We skip the auth-guard
 * on that initial invocation and only enforce it once the SDK has had
 * a chance to restore the token.
 */
async function initAuth() {
  /* Dynamically import Firebase only when auth is needed.
   * This defers ~100 KB of Firebase SDK from the critical path. */
  const { ecoService } = await import("./firebase.js");
  let firstCall = true;
  await ecoService.onAuthState(async (user) => {
    appState.user = user;
    appState.profile = user ? await ecoService.getProfile(user) : null;
    appState.authReady = true;
    updateAuthUI(appState.user, appState.profile);

    if (firstCall && !user) {
      // Firebase may still be restoring a persisted session —
      // wait briefly before enforcing the guard.
      firstCall = false;
      await new Promise((r) => setTimeout(r, 1500));
      // Re-check: user may have been set by a second callback
      if (!appState.user) enforceAuthGuard(null);
    } else {
      firstCall = false;
      enforceAuthGuard(appState.user);
    }

    userReadyHandlers.forEach((handler) => handler(appState.user, appState.profile));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  initNavigation();
  initCarbonCounter();
  initCountryEmissions();

  initAuthActions();
  initFooterYear();
  initReducedMotionToggle();
  initAuth();

  // Lazy-load chatbot after initial render to avoid blocking page load
  let chatbotLoaded = false;
  function loadChatbot() {
    if (chatbotLoaded) return;
    chatbotLoaded = true;
    import("./chatbot.js").then((m) => m.initEcoBot()).catch(() => {});
  }
  setTimeout(loadChatbot, CHATBOT_LAZY_DELAY_MS);
  document.addEventListener("click", loadChatbot, { once: true });
  document.addEventListener("keydown", loadChatbot, { once: true });

  // Register service worker for caching
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // Marquee pause/play toggle
  const pauseBtn = document.querySelector("[data-marquee-pause]");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      const wrapper = document.querySelector(".marquee-wrapper");
      if (!wrapper) return;
      const isPaused = wrapper.classList.toggle("marquee-paused");
      const icon = document.createElement("i");
      icon.className = isPaused ? "fa-solid fa-play" : "fa-solid fa-pause";
      icon.setAttribute("aria-hidden", "true");
      pauseBtn.replaceChildren(icon, ` ${isPaused ? "Play" : "Pause"}`);
      pauseBtn.setAttribute("aria-label", isPaused ? "Resume testimonial scrolling" : "Pause testimonial scrolling");
    });
  }
});
