import { TIP_CATEGORIES } from "./data.js?v=firebase-config-17";
import { appState, onUserReady, setButtonBusy, showToast } from "./app.js?v=firebase-config-17";
import { ecoService } from "./firebase.js?v=firebase-config-17";
import { getPersonalizedTips } from "./gemini.js?v=firebase-config-17";

const tabs = document.querySelector("[data-tip-tabs]");
const grid = document.querySelector("[data-tips-grid]");
const status = document.querySelector("[data-tips-status]");
const refreshButton = document.querySelector("[data-refresh-tips]");
let activeCategory = "All";
let currentTips = [];
let currentProfile = {};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cacheKey(profile) {
  return `ecotrace.tips.${todayKey()}.${Math.round(profile?.totalKg || 0)}`;
}

function getSessionProfile() {
  try {
    return JSON.parse(sessionStorage.getItem("ecotrace.latestProfile") || "null");
  } catch {
    return null;
  }
}

async function getFootprintProfile(user) {
  const sessionProfile = getSessionProfile();
  if (sessionProfile) return sessionProfile;
  const footprints = await ecoService.getFootprints(user);
  return footprints.sort((a, b) => new Date(b.date) - new Date(a.date))[0] || {};
}

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
