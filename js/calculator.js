/**
 * @module calculator
 * Multi-step carbon footprint calculator with emission-factor search,
 * real-time scoring, comparison bars, and Gemini AI-powered tips.
 */

import { ECO_CONFIG } from "./config.js";
import { appState, clamp, formatKg, onUserReady, setButtonBusy, showToast } from "./app.js";
import { ecoService } from "./firebase.js";
import { getPersonalizedTips } from "./gemini.js";
import { logError } from "./logger.js";
import { EMISSION_FACTORS, matchesEmissionFactor } from "./emission-factors.js";
import { calculateFootprint } from "./calculator-engine.js";

/** @type {Function} Analytics tracker — safe no-op if firebase export fails. */
let trackEvent = () => {};
import("./firebase.js")
  .then((mod) => { trackEvent = mod.trackEvent || trackEvent; })
  .catch(() => { /* analytics unavailable */ });

/** @type {HTMLFormElement|null} Main calculator form element. */
const form = document.querySelector("[data-calculator-form]");
const panels = [...document.querySelectorAll("[data-step-panel]")];
const steps = [...document.querySelectorAll("[data-step-indicator]")];
const resultPanel = document.querySelector("[data-result-panel]");
const aiTipsPanel = document.querySelector("[data-ai-tips-panel]");
const emissionSearchForm = document.querySelector("[data-emission-search-form]");
const emissionSearchResults = document.querySelector("[data-emission-search-results]");

/* ── Named constants ───────────────────────────────────────────────── */

/** @type {number} First wizard step index. */
const FIRST_STEP = 1;

/** @type {number} Maximum number of AI tips rendered. */
const MAX_AI_TIPS_DISPLAY = 8;

/** @type {number} Currently active wizard step (1-indexed). */
let activeStep = FIRST_STEP;

/** @type {Object|undefined} Most recent calculation result. */
let latestResult;

/** @type {number} Debounce delay (ms) for live score recalculation. */
const DEBOUNCE_SCORE_MS = 150;

/** @type {number} Debounce delay (ms) for emission factor search. */
const DEBOUNCE_SEARCH_MS = 200;

/**
 * Creates a debounced version of the given function that delays invocation
 * until `delay` milliseconds have elapsed since the last call.
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function} The debounced wrapper.
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Extracts a non-negative number from a FormData object.
 * @param {FormData} data - The FormData instance to read from.
 * @param {string} key - The form field name to look up.
 * @returns {number} The parsed numeric value, clamped to a minimum of 0.
 */
function numberFromForm(data, key) {
  return Math.max(0, Number(data.get(key)) || 0);
}

/**
 * Collects all current form field values into a structured calculator input object.
 * @returns {{ carKm: number, flights: number, publicTransport: string, dietType: string, foodWaste: string, electricityBill: number, climateControl: boolean, renewable: boolean, onlineOrders: number, clothes: number, electronics: number }} An object containing every calculator input field.
 */
function getCalculatorData() {
  const data = new FormData(form);
  return {
    carKm: numberFromForm(data, "carKm"),
    flights: numberFromForm(data, "flights"),
    publicTransport: String(data.get("publicTransport") || "weekly"),
    dietType: String(data.get("dietType") || "vegetarian"),
    foodWaste: String(data.get("foodWaste") || "medium"),
    electricityBill: numberFromForm(data, "electricityBill"),
    climateControl: data.get("climateControl") === "yes",
    renewable: data.get("renewable") === "yes",
    onlineOrders: numberFromForm(data, "onlineOrders"),
    clothes: numberFromForm(data, "clothes"),
    electronics: numberFromForm(data, "electronics"),
  };
}

/**
 * Calculates the annual carbon footprint from user inputs.
 * Delegates to the pure engine module for the actual math.
 * @param {Object} [input=getCalculatorData()] - Calculator input values.
 * @returns {{ formData: Object, breakdown: { transport: number, food: number, energy: number, shopping: number }, totalKg: number }}
 */
export { calculateFootprint } from "./calculator-engine.js";

/**
 * Updates wizard step visibility and indicator states based on the current activeStep.
 * Shows/hides step panels, toggles active/complete classes on indicators,
 * and toggles prev/next/finish button visibility.
 * @returns {void}
 */
function renderStep() {
  panels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== activeStep;
  });
  steps.forEach((step) => {
    const stepNumber = Number(step.dataset.stepIndicator);
    step.classList.toggle("is-active", stepNumber === activeStep);
    step.classList.toggle("is-complete", stepNumber < activeStep);
    step.setAttribute("aria-current", stepNumber === activeStep ? "step" : "false");
  });
  document.querySelector("[data-prev-step]")?.toggleAttribute("hidden", activeStep === 1);
  document.querySelector("[data-next-step]")?.toggleAttribute("hidden", activeStep === panels.length);
  document.querySelector("[data-finish-step]")?.toggleAttribute("hidden", activeStep !== panels.length);
}

/**
 * Recalculates the footprint and updates all live score displays,
 * category breakdown bars, tree-offset count, and comparison bars
 * (user vs. India average vs. world average).
 * @returns {void}
 */
function renderScore() {
  latestResult = calculateFootprint(getCalculatorData());
  const total = latestResult.totalKg;
  const trees = Math.ceil(total / ECO_CONFIG.app.kgPerTreePerYear);
  document.querySelectorAll("[data-live-score]").forEach((node) => {
    node.textContent = `${total.toLocaleString()} kg CO₂/year`;
  });
  document.querySelectorAll("[data-tree-count]").forEach((node) => {
    node.textContent = trees.toLocaleString();
  });
  Object.entries(latestResult.breakdown).forEach(([category, value]) => {
    document.querySelectorAll(`[data-category-score="${category}"]`).forEach((node) => {
      node.textContent = `${value.toLocaleString()} kg`;
    });
    document.querySelectorAll(`[data-category-bar="${category}"]`).forEach((node) => {
      node.style.inlineSize = `${clamp((value / Math.max(total, 1)) * 100, 3, 100)}%`;
    });
  });
  const comparison = [
    ["you", total, Math.min(100, (total / ECO_CONFIG.app.worldAverageKg) * 100)],
    ["india", ECO_CONFIG.app.indiaAverageKg, (ECO_CONFIG.app.indiaAverageKg / ECO_CONFIG.app.worldAverageKg) * 100],
    ["world", ECO_CONFIG.app.worldAverageKg, 100],
  ];
  comparison.forEach(([key, value, width]) => {
    const bar = document.querySelector(`[data-comparison-bar="${key}"]`);
    const label = document.querySelector(`[data-comparison-value="${key}"]`);
    if (bar) bar.style.inlineSize = `${clamp(width, 5, 100)}%`;
    if (label) label.textContent = formatKg(value);
  });
}

/**
 * Reveals the result panel after recalculating scores and scrolls it into view.
 * @returns {void}
 */
function showResults() {
  renderScore();
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Renders a list of AI-generated personalised tips into the AI tips panel.
 * @param {Array<{ title: string, category: string, savingKg: number, difficulty: string, body: string }>} tips - Array of tip objects returned by Gemini AI.
 * @param {string} [sourceMessage=""] - Optional status message describing how tips were generated.
 * @returns {void}
 */
function renderAiTips(tips, sourceMessage = "") {
  if (!aiTipsPanel) return;
  aiTipsPanel.hidden = false;
  const list = aiTipsPanel.querySelector("[data-ai-tips-list]");
  const status = aiTipsPanel.querySelector("[data-ai-tips-status]");
  list.replaceChildren();
  if (status) status.textContent = sourceMessage;
  tips.forEach((tip) => {
    const item = document.createElement("article");
    item.className = "mini-tip";
    const title = document.createElement("h4");
    title.textContent = tip.title;
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = `${tip.category} • Saves about ${tip.savingKg} kg CO₂/year • ${tip.difficulty}`;
    const body = document.createElement("p");
    body.textContent = tip.body;
    item.append(title, meta, body);
    list.append(item);
  });
  aiTipsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Sets the value of all form controls matching the given field name.
 * Handles radio buttons, checkboxes, and standard inputs appropriately.
 * @param {string} name - The form control name attribute to target.
 * @param {string|number|boolean} value - The value to apply to the control(s).
 * @returns {void}
 */
function setNamedField(name, value) {
  const controls = form.querySelectorAll(`[name="${name}"]`);
  controls.forEach((control) => {
    if (control.type === "radio") {
      control.checked = control.value === String(value);
    } else if (control.type === "checkbox") {
      control.checked = Boolean(value);
    } else {
      control.value = String(value);
    }
  });
}

/**
 * Applies an emission factor's example values to the calculator form,
 * navigates to the relevant wizard step, recalculates the score, and shows a toast.
 * @param {{ title: string, apply?: { step: number, fields: Object<string, string|number|boolean> } }} factor - The emission factor whose example values to apply.
 * @returns {void}
 */
function applyEmissionFactor(factor) {
  if (!factor.apply) return;
  Object.entries(factor.apply.fields).forEach(([name, value]) => setNamedField(name, value));
  activeStep = factor.apply.step;
  renderStep();
  renderScore();
  showToast(`${factor.title} example applied to the calculator.`);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Filters the emission factor database by query and renders matching result cards.
 * Shows an empty-state message when no factors match. Cards with an `apply`
 * property include a button to prefill the calculator form.
 * @param {string} [query=""] - The search query to filter emission factors by.
 * @returns {void}
 */
function renderEmissionSearchResults(query = "") {
  if (!emissionSearchResults) return;
  const results = EMISSION_FACTORS.filter((factor) => matchesEmissionFactor(factor, query)).slice(0, query ? MAX_AI_TIPS_DISPLAY : 6);
  emissionSearchResults.replaceChildren();
  if (!results.length) {
    const empty = document.createElement("article");
    empty.className = "search-result-card";
    const title = document.createElement("h3");
    title.textContent = "No emission factor found";
    const body = document.createElement("p");
    body.className = "muted";
    body.textContent = "Try a broader term like transport, electricity, food, clothes, or electronics.";
    empty.append(title, body);
    emissionSearchResults.append(empty);
    return;
  }
  results.forEach((factor) => {
    const card = document.createElement("article");
    card.className = "search-result-card";
    const category = document.createElement("span");
    category.className = "eyebrow";
    category.textContent = factor.category;
    const title = document.createElement("h3");
    title.textContent = factor.title;
    const estimate = document.createElement("strong");
    estimate.className = "emission-estimate";
    estimate.textContent = factor.estimate;
    const detail = document.createElement("p");
    detail.className = "muted";
    detail.textContent = factor.detail;
    card.append(category, title, estimate, detail);
    if (factor.apply) {
      const button = document.createElement("button");
      button.className = "btn btn-small btn-secondary";
      button.type = "button";
      button.textContent = "Use this example";
      button.addEventListener("click", () => applyEmissionFactor(factor));
      card.append(button);
    }
    emissionSearchResults.append(card);
  });
}

/**
 * Initialises the multi-step calculator by wiring up all event listeners
 * (form input/change/submit, step navigation, save result, AI tips request,
 * and emission search), then renders the initial step, score, and search results.
 * @returns {void}
 */
function initCalculator() {
  if (!form) return;
  const debouncedScore = debounce(renderScore, DEBOUNCE_SCORE_MS);
  form.addEventListener("input", debouncedScore);
  form.addEventListener("change", debouncedScore);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showResults();
  });

  document.querySelector("[data-next-step]")?.addEventListener("click", () => {
    activeStep = clamp(activeStep + 1, 1, panels.length);
    renderStep();
  });
  document.querySelector("[data-prev-step]")?.addEventListener("click", () => {
    activeStep = clamp(activeStep - 1, 1, panels.length);
    renderStep();
  });
  document.querySelector("[data-finish-step]")?.addEventListener("click", showResults);
  steps.forEach((step) => {
    step.addEventListener("click", () => {
      activeStep = Number(step.dataset.stepIndicator) || activeStep;
      renderStep();
    });
  });

  document.querySelector("[data-save-result]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    setButtonBusy(button, true, "Saving...");
    try {
      renderScore();
      await ecoService.saveFootprint(appState.user, latestResult);
      sessionStorage.setItem("ecotrace.latestProfile", JSON.stringify(latestResult));
      localStorage.setItem("lastFootprintKg", String(latestResult.totalKg));
      localStorage.setItem('ecotrace.lastBreakdown', JSON.stringify({
        transport: latestResult.breakdown.transport,
        food: latestResult.breakdown.food,
        energy: latestResult.breakdown.energy,
        shopping: latestResult.breakdown.shopping,
      }));
      // Also add to activities cache so the heatmap picks it up
      const activities = JSON.parse(localStorage.getItem('eco-activities-cache') || '[]');
      activities.push({
        createdAt: new Date().toISOString(),
        co2Kg: latestResult.totalKg,
        type: 'calculator',
      });
      localStorage.setItem('eco-activities-cache', JSON.stringify(activities));
      showToast("Footprint result saved.");
      trackEvent("calculator_completed", { total_kg: Math.round(latestResult.totalKg) });
    } catch (error) {
      logError('calculator', error);
      showToast("Result could not be saved. Please try again.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  document.querySelector("[data-get-ai-tips]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    setButtonBusy(button, true, "Asking Gemini...");
    try {
      renderScore();
      const response = await getPersonalizedTips(latestResult);
      sessionStorage.setItem("ecotrace.aiTips", JSON.stringify({ tips: response.tips, cacheKey: `ecotrace.tips.${new Date().toISOString().slice(0, 10)}.${Math.round(latestResult?.totalKg || 0)}` }));
      renderAiTips(response.tips, response.message || `Tips generated via ${response.source}.`);
    } catch (error) {
      logError('calculator', error);
      showToast("AI tips are unavailable right now.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  emissionSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(new FormData(emissionSearchForm).get("query") || "").trim();
    renderEmissionSearchResults(query);
  });

  emissionSearchForm?.querySelector("input[type='search']")?.addEventListener("input", debounce((event) => {
    renderEmissionSearchResults(event.currentTarget.value.trim());
  }, DEBOUNCE_SEARCH_MS));

  renderStep();
  renderScore();
  renderEmissionSearchResults();
}

onUserReady(() => {
  document.querySelector("[data-save-result]")?.toggleAttribute("disabled", false);
});

initCalculator();
