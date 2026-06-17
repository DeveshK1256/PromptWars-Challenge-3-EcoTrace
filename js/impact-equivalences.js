/**
 * @module impact-equivalences
 * Converts CO₂ savings into tangible real-world equivalences.
 * Makes abstract carbon numbers meaningful with trees, km, kWh, meals.
 */

/* ── Conversion Factors ────────────────────────────────────────────── */

/** @type {Array<{id: string, label: string, icon: string, factor: number, unit: string, description: string}>} */
export const EQUIVALENCES = [
  { id: "trees", label: "Trees planted", icon: "🌳", factor: 22, unit: "trees", description: "1 tree absorbs ~22 kg CO₂/year" },
  { id: "driving", label: "Km not driven", icon: "🚗", factor: 0.21, unit: "km", description: "1 km driving emits ~0.21 kg CO₂" },
  { id: "electricity", label: "kWh saved", icon: "⚡", factor: 0.5, unit: "kWh", description: "1 kWh grid electricity ≈ 0.5 kg CO₂" },
  { id: "meals", label: "Beef meals avoided", icon: "🍔", factor: 3.3, unit: "meals", description: "1 beef meal ≈ 3.3 kg CO₂" },
  { id: "flights", label: "Short flights avoided", icon: "✈️", factor: 255, unit: "flights", description: "1 domestic flight ≈ 255 kg CO₂" },
  { id: "phones", label: "Phone charges", icon: "📱", factor: 0.008, unit: "charges", description: "Charging a phone ≈ 8g CO₂" },
];

/**
 * Calculates equivalences for a given CO₂ amount.
 * @param {number} co2Kg - CO₂ in kilograms.
 * @returns {Array<{id: string, label: string, icon: string, value: number, unit: string, description: string}>}
 */
export function calculateEquivalences(co2Kg) {
  return EQUIVALENCES.map((eq) => ({
    ...eq,
    value: eq.factor < 1 ? Math.round(co2Kg / eq.factor) : Math.round(co2Kg / eq.factor),
  }));
}

/**
 * Renders equivalence cards into a container element.
 * @param {HTMLElement} container - Target container.
 * @param {number} co2Kg - CO₂ amount in kilograms.
 * @returns {void}
 */
export function renderEquivalences(container, co2Kg) {
  if (!container || co2Kg <= 0) return;
  container.textContent = "";

  const title = document.createElement("h3");
  title.textContent = "Your impact in real terms";
  title.className = "equiv-title";
  container.append(title);

  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = `${Math.round(co2Kg).toLocaleString()} kg CO₂ is equivalent to:`;
  container.append(subtitle);

  const grid = document.createElement("div");
  grid.className = "equiv-grid";

  calculateEquivalences(co2Kg).forEach((eq) => {
    const card = document.createElement("div");
    card.className = "equiv-card";

    const iconEl = document.createElement("span");
    iconEl.className = "equiv-icon";
    iconEl.textContent = eq.icon;
    iconEl.setAttribute("aria-hidden", "true");

    const valueEl = document.createElement("strong");
    valueEl.className = "equiv-value";
    valueEl.textContent = eq.value.toLocaleString();

    const labelEl = document.createElement("span");
    labelEl.className = "equiv-label";
    labelEl.textContent = eq.label;

    const descEl = document.createElement("small");
    descEl.className = "equiv-desc muted";
    descEl.textContent = eq.description;

    card.append(iconEl, valueEl, labelEl, descEl);
    grid.append(card);
  });

  container.append(grid);
}
