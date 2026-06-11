/**
 * @module emission-factors
 * Searchable emission-factor reference database and matching utilities.
 * Each entry has keywords for fuzzy matching, an estimate string,
 * and optional `apply` fields that can prefill the calculator form.
 */

/**
 * Searchable emission-factor reference database.
 * Each entry has keywords for fuzzy matching, an estimate string,
 * and optional `apply` fields that can prefill the calculator form.
 *
 * @type {Array<{id: string, category: string, title: string, estimate: string, detail: string, keywords: string[], apply?: {step: number, fields: Object}}>}
 */
export const EMISSION_FACTORS = [
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
 * Tests whether an emission factor matches a search query using case-insensitive substring matching
 * across the factor's title, category, estimate, detail, and keywords.
 * @param {{ title: string, category: string, estimate: string, detail: string, keywords: string[] }} factor - The emission factor entry to test.
 * @param {string} query - The user's search query (empty string matches everything).
 * @returns {boolean} True if the factor matches the query or the query is empty.
 */
export function matchesEmissionFactor(factor, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack =
    `${factor.title} ${factor.category} ${factor.estimate} ${factor.detail} ${factor.keywords.join(" ")}`.toLowerCase();
  return haystack.includes(needle);
}
