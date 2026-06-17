/**
 * @module data
 * Barrel re-export for all static reference data in EcoTrace.
 *
 * The data is split by domain into smaller, focused modules:
 * - {@link module:data-challenges} — CHALLENGES, BADGES
 * - {@link module:data-tips} — FALLBACK_TIPS, TIP_CATEGORIES
 * - {@link module:data-feed} — FEED_ARTICLES, NEWS_TOPICS, MAP_FALLBACK_SPOTS
 * - {@link module:data-countries} — COUNTRY_EMISSIONS, COUNTRY_EMISSIONS_YEARS
 *
 * All exports are re-exported here for backward compatibility — existing
 * `import { X } from "./data.js"` statements continue to work unchanged.
 */

export { CHALLENGES, BADGES } from './data-challenges.js';
export { FALLBACK_TIPS, TIP_CATEGORIES } from './data-tips.js';
export { FEED_ARTICLES, NEWS_TOPICS, MAP_FALLBACK_SPOTS } from './data-feed.js';
export { COUNTRY_EMISSIONS, COUNTRY_EMISSIONS_YEARS } from './data-countries.js';
