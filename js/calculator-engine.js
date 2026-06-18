/**
 * @module calculator-engine
 * Pure calculation logic for the carbon footprint calculator.
 * Contains no DOM dependencies — safe to import in tests, workers, and SSR.
 *
 * @see {@link ./calculator.js} for the UI layer that consumes these functions.
 */

/* ── Named constants for emission factors ──────────────────────── */

/** @type {Object<string, number>} Public transport multipliers by frequency. */
export const TRANSPORT_MULTIPLIERS = {
  none: 1.12,
  occasional: 0.98,
  weekly: 0.86,
  daily: 0.68,
};

/** @type {Object<string, number>} Annual diet base emissions (kg CO₂). */
export const DIET_BASE_EMISSIONS = {
  vegan: 780,
  vegetarian: 1120,
  meat: 1780,
};

/** @type {Object<string, number>} Additional waste emissions by level (kg CO₂). */
export const WASTE_ADDITIONS = {
  low: 60,
  medium: 180,
  high: 360,
};

/** @type {number} kg CO₂ per weekly car-km (annualised: 0.12 × 52). */
export const CAR_KG_PER_KM_WEEKLY = 0.12;

/** @type {number} Weeks per year. */
export const WEEKS_PER_YEAR = 52;

/** @type {number} kg CO₂ per flight. */
export const FLIGHT_EMISSIONS_KG = 250;

/** @type {number} Minimum transport emissions floor (kg CO₂/yr). */
export const MIN_TRANSPORT_KG = 120;

/** @type {number} INR-to-kWh conversion factor (₹ / kWh). */
export const INR_PER_KWH = 8.5;

/** @type {number} Grid emission factor (kg CO₂ per kWh). */
export const GRID_EMISSION_FACTOR = 0.72;

/** @type {number} Months per year. */
export const MONTHS_PER_YEAR = 12;

/** @type {number} Climate-control add-on (kg CO₂/yr) when enabled. */
export const CLIMATE_CONTROL_ON = 310;

/** @type {number} Climate-control add-on (kg CO₂/yr) when not enabled. */
export const CLIMATE_CONTROL_OFF = 80;

/** @type {number} Renewable energy reduction multiplier. */
export const RENEWABLE_MULTIPLIER = 0.65;

/** @type {number} kg CO₂ per online order per month (annualised: × 12). */
export const ORDER_EMISSIONS_KG = 6;

/** @type {number} kg CO₂ per clothing item. */
export const CLOTHING_EMISSIONS_KG = 18;

/** @type {number} kg CO₂ per electronic device. */
export const ELECTRONICS_EMISSIONS_KG = 220;

/** @type {number} Baseline shopping emissions (kg CO₂/yr). */
export const SHOPPING_BASELINE_KG = 120;

/* ── Core calculation ──────────────────────────────────────────── */

/**
 * Calculates the annual carbon footprint from user inputs.
 * Pure function — no side effects, no DOM access.
 *
 * @param {Object} input - Calculator input values.
 * @param {number} input.carKm - Weekly car kilometres driven.
 * @param {number} input.flights - Number of flights per year.
 * @param {string} input.publicTransport - Frequency ('none'|'occasional'|'weekly'|'daily').
 * @param {string} input.dietType - Diet type ('vegan'|'vegetarian'|'meat').
 * @param {string} input.foodWaste - Food waste level ('low'|'medium'|'high').
 * @param {number} input.electricityBill - Monthly electricity bill in INR.
 * @param {boolean} input.climateControl - Whether AC/heater is used regularly.
 * @param {boolean} input.renewable - Whether renewable energy sources are used.
 * @param {number} input.onlineOrders - Number of online orders per month.
 * @param {number} input.clothes - Number of new clothing items per year.
 * @param {number} input.electronics - Number of new electronic devices per year.
 * @returns {{ formData: Object, breakdown: { transport: number, food: number, energy: number, shopping: number }, totalKg: number }}
 */
export function calculateFootprint(input) {
  const ptMultiplier = TRANSPORT_MULTIPLIERS[input.publicTransport] ?? TRANSPORT_MULTIPLIERS.weekly;
  const transport = Math.max(
    MIN_TRANSPORT_KG,
    input.carKm * CAR_KG_PER_KM_WEEKLY * WEEKS_PER_YEAR * ptMultiplier + input.flights * FLIGHT_EMISSIONS_KG,
  );

  const dietBase = DIET_BASE_EMISSIONS[input.dietType] ?? DIET_BASE_EMISSIONS.vegetarian;
  const wasteAdd = WASTE_ADDITIONS[input.foodWaste] ?? WASTE_ADDITIONS.medium;
  const food = dietBase + wasteAdd;

  const monthlyKwh = input.electricityBill / INR_PER_KWH;
  let energy = monthlyKwh * GRID_EMISSION_FACTOR * MONTHS_PER_YEAR + (input.climateControl ? CLIMATE_CONTROL_ON : CLIMATE_CONTROL_OFF);
  if (input.renewable) energy *= RENEWABLE_MULTIPLIER;

  const shopping =
    input.onlineOrders * ORDER_EMISSIONS_KG * MONTHS_PER_YEAR +
    input.clothes * CLOTHING_EMISSIONS_KG +
    input.electronics * ELECTRONICS_EMISSIONS_KG +
    SHOPPING_BASELINE_KG;

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
 * Calculates per-category percentage shares from a breakdown object.
 * @param {{ transport: number, food: number, energy: number, shopping: number }} breakdown
 * @returns {{ transport: number, food: number, energy: number, shopping: number }} Percentages (0–100).
 */
export function getBreakdownPercentages(breakdown) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;
  return {
    transport: Math.round((breakdown.transport / total) * 100),
    food: Math.round((breakdown.food / total) * 100),
    energy: Math.round((breakdown.energy / total) * 100),
    shopping: Math.round((breakdown.shopping / total) * 100),
  };
}
