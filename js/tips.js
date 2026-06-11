/**
 * @module tips
 * Personalised eco-tips page powered by Gemini AI with category
 * filtering, session caching, and tip-completion tracking.
 */
import { TIP_CATEGORIES } from "./data.js?v=firebase-config-35";
import { appState, onUserReady, setButtonBusy, showToast } from "./app.js?v=firebase-config-35";
import { ecoService } from "./firebase.js?v=firebase-config-35";
import { getPersonalizedTips } from "./gemini.js?v=firebase-config-35";

const tabs = document.querySelector("[data-tip-tabs]");
const grid = document.querySelector("[data-tips-grid]");
const status = document.querySelector("[data-tips-status]");
const refreshButton = document.querySelector("[data-refresh-tips]");
let activeCategory = "All";
let currentTips = [];
let currentProfile = {};

/**
 * Returns today's date as an ISO date string (YYYY-MM-DD) for use as a cache key segment.
 * @returns {string} Today's date in 'YYYY-MM-DD' format.
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds a localStorage cache key combining today's date and the profile's
 * rounded total kg value, ensuring cached tips are scoped per day and footprint.
 * @param {Object|null} profile - The user's footprint profile.
 * @param {number} [profile.totalKg=0] - The total annual CO₂ in kilograms.
 * @returns {string} A cache key like 'ecotrace.tips.2026-06-11.2400'.
 */
function cacheKey(profile) {
  return `ecotrace.tips.${todayKey()}.${Math.round(profile?.totalKg || 0)}`;
}

/**
 * Retrieves the latest footprint profile from sessionStorage.
 * Returns null if no profile is stored or if parsing fails.
 * @returns {Object|null} The parsed footprint profile, or null.
 */
function getSessionProfile() {
  try {
    return JSON.parse(sessionStorage.getItem("ecotrace.latestProfile") || "null");
  } catch {
    return null;
  }
}

/**
 * Resolves the user's most recent footprint profile, first checking
 * sessionStorage and falling back to a Firestore query.
 * @param {Object} user - The authenticated Firebase user object.
 * @returns {Promise<Object>} The most recent footprint profile, or an empty object.
 * @throws {Error} If the Firestore query fails and no session profile exists.
 */
async function getFootprintProfile(user) {
  const sessionProfile = getSessionProfile();
  if (sessionProfile) return sessionProfile;
  const footprints = await ecoService.getFootprints(user);
  return footprints.sort((a, b) => new Date(b.date) - new Date(a.date))[0] || {};
}

/**
 * Renders the category filter tab buttons (e.g. All, Transport, Food).
 * Highlights the currently active category and re-renders tips on click.
 * @returns {void}
 */
function renderTabs() {
  if (!tabs) return;
  tabs.replaceChildren();
  TIP_CATEGORIES.forEach((category) => {
    const button = document.createElement("button");
    button.className = "filter-tab";
    button.type = "button";
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      renderTabs();
      renderTips();
    });
    tabs.append(button);
  });
}

/**
 * Renders the tip cards into the grid, filtered by the active category.
 * Each card shows the tip's category, title, body, CO₂ saving, difficulty,
 * and a "Mark as Done" button that awards Green Points on completion.
 * @returns {void}
 */
function renderTips() {
  if (!grid) return;
  const completed = new Set(appState.profile?.completedTips || []);
  const visibleTips =
    activeCategory === "All" ? currentTips : currentTips.filter((tip) => tip.category === activeCategory);
  grid.replaceChildren();
  visibleTips.forEach((tip) => {
    const card = document.createElement("article");
    card.className = "tip-card";
    const category = document.createElement("span");
    category.className = "eyebrow";
    category.textContent = tip.category;
    const title = document.createElement("h3");
    title.textContent = tip.title;
    const body = document.createElement("p");
    body.textContent = tip.body;
    const meta = document.createElement("div");
    meta.className = "tip-meta";
    const saving = document.createElement("span");
    saving.textContent = `${tip.savingKg} kg CO₂ saved`;
    const difficulty = document.createElement("span");
    difficulty.className = `difficulty difficulty-${tip.difficulty.toLowerCase()}`;
    difficulty.textContent = tip.difficulty;
    meta.append(saving, difficulty);
    const action = document.createElement("button");
    action.className = "btn btn-small btn-primary";
    action.type = "button";
    action.textContent = completed.has(tip.id) ? "Done ✅" : "Mark as Done ✅";
    action.disabled = completed.has(tip.id);
    action.addEventListener("click", async () => {
      setButtonBusy(action, true, "Saving...");
      try {
        const result = await ecoService.completeTip(appState.user, tip);
        appState.profile = result.profile;
        showToast(result.awarded ? "Nice, +10 Green Points!" : "You already earned points for this tip.");
        renderTips();
      } catch (error) {
        console.error(error);
        showToast("Could not save tip completion.", "error");
      } finally {
        setButtonBusy(action, false);
      }
    });
    card.append(category, title, body, meta, action);
    grid.append(card);
  });
}

/**
 * Loads personalised tips from session cache, localStorage cache, or
 * the Gemini AI API, then renders tabs and tip cards.
 * @param {Object} user - The authenticated Firebase user object.
 * @param {boolean} [force=false] - When true, bypasses all caches and fetches fresh tips.
 * @returns {Promise<void>} Resolves when tips have been loaded and rendered.
 * @throws {Error} If the Gemini AI request fails and no cached tips are available.
 */
async function loadTips(user, force = false) {
  currentProfile = await getFootprintProfile(user);
  const key = cacheKey(currentProfile);
  const sessionTips = JSON.parse(sessionStorage.getItem("ecotrace.aiTips") || "null");
  const cached = JSON.parse(localStorage.getItem(key) || "null");
  if (!force && sessionTips?.length) {
    currentTips = sessionTips;
    if (status) status.textContent = "Showing tips generated from your latest calculator result.";
  } else if (!force && cached?.tips?.length) {
    currentTips = cached.tips;
    if (status) status.textContent = "Showing today's saved tip refresh.";
  } else {
    if (status) status.textContent = "Refreshing your personalized tips...";
    const response = await getPersonalizedTips(currentProfile);
    currentTips = response.tips;
    localStorage.setItem(key, JSON.stringify({ tips: currentTips, savedAt: new Date().toISOString() }));
    if (status) status.textContent = response.message || `Top tips loaded from ${response.source}.`;
  }
  renderTabs();
  renderTips();
}

refreshButton?.addEventListener("click", async () => {
  setButtonBusy(refreshButton, true, "Refreshing...");
  try {
    sessionStorage.removeItem("ecotrace.aiTips");
    await loadTips(appState.user, true);
    showToast("Tips refreshed for today.");
  } catch (error) {
    console.error(error);
    showToast("Tips could not be refreshed.", "error");
  } finally {
    setButtonBusy(refreshButton, false);
  }
});

onUserReady((user) => {
  loadTips(user).catch((error) => {
    console.error(error);
    if (status) status.textContent = "Tips could not load. Try refreshing in a moment.";
  });
});
