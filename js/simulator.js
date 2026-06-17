/**
 * @module simulator
 * "What If?" Carbon Reduction Simulator — interactive sliders that show
 * the impact of lifestyle changes on annual CO₂ emissions in real-time.
 */

/* ── Constants ─────────────────────────────────────────────────────── */

/** @type {Array<{id: string, label: string, icon: string, unit: string, min: number, max: number, step: number, defaultVal: number, savingPerUnit: number, description: string}>} */
const SIMULATOR_ACTIONS = [
  {
    id: "sim-bike-trips",
    label: "Bike instead of drive",
    icon: "fa-bicycle",
    unit: "trips/week",
    min: 0, max: 14, step: 1, defaultVal: 0,
    savingPerUnit: 3.2 * 52, // ~3.2 kg CO₂ per car trip avoided, × 52 weeks
    description: "Each car trip replaced with cycling saves ~3.2 kg CO₂",
  },
  {
    id: "sim-public-transport",
    label: "Public transport instead of car",
    icon: "fa-bus",
    unit: "trips/week",
    min: 0, max: 10, step: 1, defaultVal: 0,
    savingPerUnit: 2.4 * 52,
    description: "Bus/metro produces ~75% less CO₂ than a solo car trip",
  },
  {
    id: "sim-vegetarian-meals",
    label: "Vegetarian meals instead of meat",
    icon: "fa-carrot",
    unit: "meals/week",
    min: 0, max: 21, step: 1, defaultVal: 0,
    savingPerUnit: 2.5 * 52,
    description: "Each meat meal replaced saves ~2.5 kg CO₂",
  },
  {
    id: "sim-led-bulbs",
    label: "Switch to LED bulbs",
    icon: "fa-lightbulb",
    unit: "bulbs",
    min: 0, max: 20, step: 1, defaultVal: 0,
    savingPerUnit: 40, // ~40 kg CO₂/year per bulb switched
    description: "LEDs use 75% less energy than incandescent bulbs",
  },
  {
    id: "sim-solar",
    label: "Install rooftop solar",
    icon: "fa-solar-panel",
    unit: "% of usage",
    min: 0, max: 100, step: 10, defaultVal: 0,
    savingPerUnit: 15, // ~15 kg CO₂/year per 1% solar coverage
    description: "Each 10% solar coverage offsets ~150 kg CO₂/year",
  },
  {
    id: "sim-shorter-showers",
    label: "Shorter showers (save 2 min)",
    icon: "fa-shower",
    unit: "showers/week",
    min: 0, max: 7, step: 1, defaultVal: 0,
    savingPerUnit: 0.5 * 52,
    description: "2 minutes less per shower saves ~0.5 kg CO₂ each time",
  },
];

/* ── DOM Builder ───────────────────────────────────────────────────── */

/**
 * Creates a single slider row for a simulator action.
 * @param {typeof SIMULATOR_ACTIONS[0]} action
 * @returns {HTMLDivElement}
 */
function createSliderRow(action) {
  const row = document.createElement("div");
  row.className = "sim-slider-row";

  const label = document.createElement("label");
  label.className = "sim-label";
  label.setAttribute("for", action.id);
  const icon = document.createElement("i");
  icon.className = `fa-solid ${action.icon}`;
  icon.setAttribute("aria-hidden", "true");
  label.append(icon, ` ${action.label}`);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = action.id;
  slider.min = String(action.min);
  slider.max = String(action.max);
  slider.step = String(action.step);
  slider.value = String(action.defaultVal);
  slider.className = "sim-slider";
  slider.setAttribute("aria-label", `${action.label} (${action.unit})`);

  const valueDisplay = document.createElement("span");
  valueDisplay.className = "sim-value";
  valueDisplay.textContent = `${action.defaultVal} ${action.unit}`;
  valueDisplay.setAttribute("data-sim-value", action.id);

  const desc = document.createElement("p");
  desc.className = "sim-description muted";
  desc.textContent = action.description;

  const savingDisplay = document.createElement("span");
  savingDisplay.className = "sim-saving";
  savingDisplay.setAttribute("data-sim-saving", action.id);
  savingDisplay.textContent = "0 kg CO₂/year saved";

  row.append(label, slider, valueDisplay, savingDisplay, desc);
  return row;
}

/**
 * Renders the total savings summary with animated counter and equivalences.
 * @param {HTMLElement} container
 * @param {number} totalSaving
 * @param {number} currentFootprint
 */
function renderSummary(container, totalSaving, currentFootprint) {
  const pct = currentFootprint > 0 ? Math.round((totalSaving / currentFootprint) * 100) : 0;
  const projected = Math.max(0, currentFootprint - totalSaving);

  container.textContent = "";

  const summaryCards = document.createElement("div");
  summaryCards.className = "sim-summary-cards";

  const cards = [
    { label: "Annual saving", value: `${Math.round(totalSaving).toLocaleString()} kg`, icon: "fa-arrow-trend-down", color: "#2f7c64" },
    { label: "Reduction", value: `${pct}%`, icon: "fa-chart-pie", color: "#a7c957" },
    { label: "Projected footprint", value: `${Math.round(projected).toLocaleString()} kg`, icon: "fa-bullseye", color: "#f4a261" },
    { label: "Trees equivalent", value: `${Math.round(totalSaving / 22)} trees`, icon: "fa-tree", color: "#264653" },
  ];

  cards.forEach(({ label, value, icon: iconClass, color }) => {
    const card = document.createElement("div");
    card.className = "sim-card";
    card.style.borderColor = color;

    const cardIcon = document.createElement("i");
    cardIcon.className = `fa-solid ${iconClass}`;
    cardIcon.style.color = color;
    cardIcon.setAttribute("aria-hidden", "true");

    const cardValue = document.createElement("strong");
    cardValue.className = "sim-card-value";
    cardValue.textContent = value;

    const cardLabel = document.createElement("span");
    cardLabel.className = "sim-card-label";
    cardLabel.textContent = label;

    card.append(cardIcon, cardValue, cardLabel);
    summaryCards.append(card);
  });

  container.append(summaryCards);

  // Draw mini bar chart
  if (totalSaving > 0) {
    const chartContainer = document.createElement("div");
    chartContainer.className = "sim-bar-chart";

    const beforeBar = document.createElement("div");
    beforeBar.className = "sim-bar";
    const beforeFill = document.createElement("div");
    beforeFill.className = "sim-bar-fill";
    beforeFill.style.width = "100%";
    beforeFill.style.background = "#e76f51";
    const beforeLabel = document.createElement("span");
    beforeLabel.textContent = `Current: ${Math.round(currentFootprint).toLocaleString()} kg`;
    beforeBar.append(beforeFill, beforeLabel);

    const afterBar = document.createElement("div");
    afterBar.className = "sim-bar";
    const afterFill = document.createElement("div");
    afterFill.className = "sim-bar-fill";
    afterFill.style.width = `${Math.max(5, Math.round((projected / currentFootprint) * 100))}%`;
    afterFill.style.background = "#2f7c64";
    const afterLabel = document.createElement("span");
    afterLabel.textContent = `Projected: ${Math.round(projected).toLocaleString()} kg`;
    afterBar.append(afterFill, afterLabel);

    chartContainer.append(beforeBar, afterBar);
    container.append(chartContainer);
  }
}

/* ── Init ──────────────────────────────────────────────────────────── */

/**
 * Initialises the What-If Simulator section.
 * @returns {void}
 */
function initSimulator() {
  const section = document.querySelector("[data-simulator]");
  if (!section) return;

  const slidersContainer = section.querySelector("[data-simulator-sliders]");
  const summaryContainer = section.querySelector("[data-simulator-summary]");
  if (!slidersContainer || !summaryContainer) return;

  // Get current footprint from latest calculator result
  const getFootprint = () => {
    try {
      const stored = sessionStorage.getItem("ecotrace.latestProfile");
      if (stored) return JSON.parse(stored).totalKg || 0;
    } catch { /* ignore */ }
    return Number(localStorage.getItem("lastFootprintKg")) || 4000; // default 4t
  };

  // Create slider rows
  SIMULATOR_ACTIONS.forEach((action) => {
    slidersContainer.append(createSliderRow(action));
  });

  // Update on slider change
  function recalculate() {
    let totalSaving = 0;
    SIMULATOR_ACTIONS.forEach((action) => {
      const slider = document.getElementById(action.id);
      if (!slider) return;
      const val = Number(slider.value);
      const saving = val * action.savingPerUnit;
      totalSaving += saving;

      const valueEl = section.querySelector(`[data-sim-value="${action.id}"]`);
      if (valueEl) valueEl.textContent = `${val} ${action.unit}`;

      const savingEl = section.querySelector(`[data-sim-saving="${action.id}"]`);
      if (savingEl) {
        savingEl.textContent = saving > 0 ? `−${Math.round(saving).toLocaleString()} kg CO₂/year` : "0 kg CO₂/year saved";
        savingEl.classList.toggle("sim-saving-active", saving > 0);
      }
    });

    renderSummary(summaryContainer, totalSaving, getFootprint());
  }

  slidersContainer.addEventListener("input", recalculate);
  recalculate();
}

initSimulator();

export { initSimulator, SIMULATOR_ACTIONS };
