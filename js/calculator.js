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

/** @type {HTMLFormElement|null} Main calculator form element. */
const form = document.querySelector("[data-calculator-form]");
const panels = [...document.querySelectorAll("[data-step-panel]")];
const steps = [...document.querySelectorAll("[data-step-indicator]")];
const resultPanel = document.querySelector("[data-result-panel]");
const aiTipsPanel = document.querySelector("[data-ai-tips-panel]");
const emissionSearchForm = document.querySelector("[data-emission-search-form]");
const emissionSearchResults = document.querySelector("[data-emission-search-results]");

/** @type {number} Currently active wizard step (1-indexed). */
let activeStep = 1;

/** @type {Object|undefined} Most recent calculation result. */
let latestResult;

/**
 * Searchable emission-factor reference database.
 * Each entry has keywords for fuzzy matching, an estimate string,
 * and optional `apply` fields that can prefill the calculator form.
 *
 * @type {Array<{id: string, category: string, title: string, estimate: string, detail: string, keywords: string[], apply?: {step: number, fields: Object}}>}
 */
const EMISSION_FACTORS = [
  {
    id: "car-travel",
    category: "Transport",
    title: "Petrol or diesel car travel",
    estimate: "About 0.12 kg CO2 per km",
    detail: "Driving 100 km per week adds roughly 535 kg CO2 per year before public transport adjustments.",
    keywords: ["car", "drive", "petrol", "diesel", "vehicle", "transport"],
    apply: { step: 1, fields: { carKm: 100, publicTransport: "occasional" } },
  },
  {
    id: "flight",
    category: "Transport",
    title: "Domestic or short-haul flight",
    estimate: "About 250 kg CO2 per flight",
    detail: "Flights are one of the fastest ways to increase an annual footprint, especially for frequent trips.",
    keywords: ["flight", "plane", "air", "travel", "trip"],
    apply: { step: 1, fields: { flights: 2 } },
  },
  {
    id: "daily-transit",
    category: "Transport",
    title: "Daily public transport",
    estimate: "Can reduce car-linked emissions by 30%+",
    detail: "Regular bus, metro, or shared transit lowers the transport multiplier in this calculator.",
    keywords: ["bus", "metro", "train", "public", "transit", "commute"],
    apply: { step: 1, fields: { publicTransport: "daily" } },
  },
  {
    id: "meat-heavy-diet",
    category: "Food",
    title: "Meat-heavy diet",
    estimate: "About 1,780 kg CO2 per year baseline",
    detail: "Diet type changes the food baseline before food waste is added.",
    keywords: ["meat", "chicken", "mutton", "beef", "diet", "food"],
    apply: { step: 2, fields: { dietType: "meat" } },
  },
  {
    id: "vegetarian-diet",
    category: "Food",
    title: "Vegetarian diet",
    estimate: "About 1,120 kg CO2 per year baseline",
    detail: "Plant-forward meals generally reduce food emissions compared with a meat-heavy diet.",
    keywords: ["vegetarian", "veg", "paneer", "dal", "diet", "food"],
    apply: { step: 2, fields: { dietType: "vegetarian" } },
  },
  {
    id: "vegan-diet",
    category: "Food",
    title: "Vegan diet",
    estimate: "About 780 kg CO2 per year baseline",
    detail: "A vegan diet has the lowest food baseline in this calculator model.",
    keywords: ["vegan", "plant", "plant-based", "diet", "food"],
    apply: { step: 2, fields: { dietType: "vegan" } },
  },
  {
    id: "food-waste",
    category: "Food",
    title: "High food waste",
    estimate: "Adds about 360 kg CO2 per year",
    detail: "Planning meals and storing food better can reduce methane-linked waste emissions.",
    keywords: ["waste", "leftover", "food waste", "garbage"],
    apply: { step: 2, fields: { foodWaste: "high" } },
  },
  {
    id: "electricity",
    category: "Energy",
    title: "Household electricity",
    estimate: "Estimated from bill divided by Rs 8.5/kWh",
    detail: "The calculator estimates kWh from your bill and applies an India grid emissions factor.",
    keywords: ["electricity", "power", "bill", "energy", "kwh"],
    apply: { step: 3, fields: { electricityBill: 3000 } },
  },
  {
    id: "ac-heater",
    category: "Energy",
    title: "Regular AC or heater use",
    estimate: "Adds about 310 kg CO2 per year",
    detail: "Raising AC temperature and using timers can reduce this category quickly.",
    keywords: ["ac", "air conditioner", "heater", "cooling", "heating"],
    apply: { step: 3, fields: { climateControl: true } },
  },
  {
    id: "renewable-energy",
    category: "Energy",
    title: "Renewable electricity",
    estimate: "Cuts modeled energy emissions by 35%",
    detail: "Rooftop solar or verified green power lowers the calculator's energy multiplier.",
    keywords: ["solar", "renewable", "green power", "energy"],
    apply: { step: 3, fields: { renewable: true } },
  },
  {
    id: "online-order",
    category: "Shopping",
    title: "Online order",
    estimate: "About 6 kg CO2 per order",
    detail: "Bundling orders and avoiding impulse purchases lowers packaging and delivery emissions.",
    keywords: ["online", "order", "shopping", "delivery", "package"],
    apply: { step: 4, fields: { onlineOrders: 8 } },
  },
  {
    id: "new-clothes",
    category: "Shopping",
    title: "New clothing item",
    estimate: "About 18 kg CO2 per item",
    detail: "Buying fewer, repairing, and choosing second-hand clothing reduces shopping emissions.",
    keywords: ["clothes", "shirt", "fashion", "jeans", "shopping"],
    apply: { step: 4, fields: { clothes: 24 } },
  },
  {
    id: "electronics",
    category: "Shopping",
    title: "New electronic device",
    estimate: "About 220 kg CO2 per device",
    detail: "Keeping devices longer or buying refurbished can avoid high manufacturing emissions.",
    keywords: ["phone", "laptop", "electronics", "device", "mobile"],
    apply: { step: 4, fields: { electronics: 1 } },
  },
  {
    id: "india-average",
    category: "Comparison",
    title: "India average footprint",
    estimate: "About 1.9 tonnes CO2 per person per year",
    detail: "Use this comparison to understand where your annual score sits nationally.",
    keywords: ["india", "average", "comparison", "total"],
  },
  {
    id: "world-average",
    category: "Comparison",
    title: "World average footprint",
    estimate: "About 4 tonnes CO2 per person per year",
    detail: "The world average is shown in the final result comparison bar.",
    keywords: ["world", "global", "average", "comparison", "total"],
  },
];

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
 * Computes category breakdowns for transport, food, energy, and shopping,
 * then returns the total alongside the original form data.
 * @param {Object} [input=getCalculatorData()] - Calculator input values; defaults to current form state.
 * @param {number} input.carKm - Weekly car kilometres driven.
 * @param {number} input.flights - Number of flights per year.
 * @param {string} input.publicTransport - Public transport frequency ('none'|'occasional'|'weekly'|'daily').
 * @param {string} input.dietType - Diet type ('vegan'|'vegetarian'|'meat').
 * @param {string} input.foodWaste - Food waste level ('low'|'medium'|'high').
 * @param {number} input.electricityBill - Monthly electricity bill in INR.
 * @param {boolean} input.climateControl - Whether AC/heater is used regularly.
 * @param {boolean} input.renewable - Whether renewable energy sources are used.
 * @param {number} input.onlineOrders - Number of online orders per month.
 * @param {number} input.clothes - Number of new clothing items per year.
 * @param {number} input.electronics - Number of new electronic devices per year.
 * @returns {{ formData: Object, breakdown: { transport: number, food: number, energy: number, shopping: number }, totalKg: number }} Calculation result with per-category breakdown and total in kg CO₂/year.
 */
export function calculateFootprint(input = getCalculatorData()) {
  const publicTransportMultiplier = {
    none: 1.12,
    occasional: 0.98,
    weekly: 0.86,
    daily: 0.68,
  }[input.publicTransport];
  const transport = Math.max(120, input.carKm * 0.12 * 52 * publicTransportMultiplier + input.flights * 250);

  const dietBase = {
    vegan: 780,
    vegetarian: 1120,
    meat: 1780,
  }[input.dietType];
  const wasteAdd = {
    low: 60,
    medium: 180,
    high: 360,
  }[input.foodWaste];
  const food = dietBase + wasteAdd;

  const monthlyKwh = input.electricityBill / 8.5;
  let energy = monthlyKwh * 0.72 * 12 + (input.climateControl ? 310 : 80);
  if (input.renewable) energy *= 0.65;

  const shopping = input.onlineOrders * 6 * 12 + input.clothes * 18 + input.electronics * 220 + 120;

  const breakdown = {
    transport: Math.round(transport),
    food: Math.round(food),
    energy: Math.round(energy),
    shopping: Math.round(shopping),
  };
  return {
    formData: input,
    breakdown,
    totalKg: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  };
}

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
  latestResult = calculateFootprint();
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
 * Tests whether an emission factor matches a search query using case-insensitive substring matching
 * across the factor's title, category, estimate, detail, and keywords.
 * @param {{ title: string, category: string, estimate: string, detail: string, keywords: string[] }} factor - The emission factor entry to test.
 * @param {string} query - The user's search query (empty string matches everything).
 * @returns {boolean} True if the factor matches the query or the query is empty.
 */
function matchesEmissionFactor(factor, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = `${factor.title} ${factor.category} ${factor.estimate} ${factor.detail} ${factor.keywords.join(" ")}`.toLowerCase();
  return haystack.includes(needle);
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
  const results = EMISSION_FACTORS.filter((factor) => matchesEmissionFactor(factor, query)).slice(0, query ? 8 : 6);
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
  form.addEventListener("input", renderScore);
  form.addEventListener("change", renderScore);
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
      showToast("Footprint result saved.");
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
      sessionStorage.setItem("ecotrace.aiTips", JSON.stringify(response.tips));
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

  emissionSearchForm?.querySelector("input[type='search']")?.addEventListener("input", (event) => {
    renderEmissionSearchResults(event.currentTarget.value.trim());
  });

  renderStep();
  renderScore();
  renderEmissionSearchResults();
}

onUserReady(() => {
  document.querySelector("[data-save-result]")?.toggleAttribute("disabled", false);
});

initCalculator();
