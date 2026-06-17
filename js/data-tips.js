/**
 * @module data-tips
 * Static fallback tips and tip category labels for EcoTrace.
 */

/**
 * Static carbon-saving tips shown when the Gemini AI service is unavailable.
 * Each tip belongs to a category and describes a concrete action with an
 * estimated annual CO₂ saving in kilograms.
 *
 * @type {Array<{
 *   id: string,
 *   category: string,
 *   title: string,
 *   savingKg: number,
 *   difficulty: "Easy"|"Medium"|"Hard",
 *   body: string
 * }>}
 */
export const FALLBACK_TIPS = [
  {
    id: "tip-transit-pass",
    category: "Transport",
    title: "Replace two short car trips with public transport",
    savingKg: 72,
    difficulty: "Easy",
    body: "Pick two predictable weekly trips under 8 km and move them to bus, metro, cycling, or walking.",
  },
  {
    id: "tip-meal-swap",
    category: "Food",
    title: "Make three dinners plant-forward",
    savingKg: 95,
    difficulty: "Medium",
    body: "Swap red meat meals for dal, chana, paneer, tofu, or seasonal vegetables three times a week.",
  },
  {
    id: "tip-ac-timer",
    category: "Energy",
    title: "Raise AC temperature by 1-2°C",
    savingKg: 120,
    difficulty: "Easy",
    body: "Set AC to 25-26°C, use sleep mode, and pair it with a ceiling fan for the same comfort.",
  },
  {
    id: "tip-buy-list",
    category: "Shopping",
    title: "Use a 48-hour buying pause",
    savingKg: 64,
    difficulty: "Easy",
    body: "Add non-essential online orders to a list and revisit after two days to avoid impulse purchases.",
  },
  {
    id: "tip-repair",
    category: "Shopping",
    title: "Repair one item before replacing it",
    savingKg: 180,
    difficulty: "Medium",
    body: "Try repair, resale, or refurbished options before buying electronics, shoes, or bags new.",
  },
];

/**
 * Filter labels for the tips section category selector.
 *
 * @type {string[]}
 */
export const TIP_CATEGORIES = ["All", "Transport", "Food", "Energy", "Shopping"];
