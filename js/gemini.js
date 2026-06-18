/**
 * @module gemini
 * Gemini AI integration for the EcoTrace application.
 * Builds prompts from user profiles, calls the Gemini API (or a proxy),
 * normalizes the response, and falls back to static tips on failure.
 */

import { ECO_CONFIG, hasGeminiConfig } from "./config.js";
import { logWarn } from "./logger.js";
import { FALLBACK_TIPS } from "./data.js";

/* ── Magic-number constants ────────────────────────────────────── */

/** @type {number} Number of personalized tips to request / return. */
const MAX_TIPS = 5;

/** @type {number} Maximum character length for a tip ID string. */
const MAX_TIP_ID_LENGTH = 80;

/** @type {number} Maximum character length for a tip title. */
const MAX_TIP_TITLE_LENGTH = 100;

/** @type {number} Maximum character length for a tip body. */
const MAX_TIP_BODY_LENGTH = 240;

/** @type {number} Minimum allowed savingKg value after normalization. */
const MIN_SAVING_KG = 5;

/** @type {number} Default savingKg when the tip provides none. */
const DEFAULT_SAVING_KG = 25;

/** @type {number} Temperature setting for the Gemini generation config (0–1 scale). */
const GEMINI_TEMPERATURE = 0.4;

/** @type {string} Netlify serverless proxy endpoint for Gemini API calls. */
const PROXY_ENDPOINT = '/.netlify/functions/gemini';

/* ── Internal helpers ──────────────────────────────────────────── */

/**
 * Builds the Gemini prompt string for a given user profile.
 *
 * @param {Object} profile - The user's carbon-footprint profile data.
 * @returns {string} A complete prompt instructing Gemini to return JSON tips.
 */
function buildPrompt(profile) {
  const lastFootprint = Number(localStorage.getItem('lastFootprintKg')) || 0;
  const breakdown = JSON.parse(localStorage.getItem('ecotrace.lastBreakdown') || 'null');

  let userContext = '';
  if (breakdown) {
    const total = lastFootprint || Object.values(breakdown).reduce((a, b) => a + b, 0);
    userContext = `\n\nUser's annual carbon footprint: ${total} kg CO₂\nBreakdown: Transport=${breakdown.transport || 0}kg (${Math.round((breakdown.transport || 0) / total * 100)}%), Food=${breakdown.food || 0}kg (${Math.round((breakdown.food || 0) / total * 100)}%), Energy=${breakdown.energy || 0}kg (${Math.round((breakdown.energy || 0) / total * 100)}%), Shopping=${breakdown.shopping || 0}kg (${Math.round((breakdown.shopping || 0) / total * 100)}%)\n\nFocus your tips on the highest-impact category first. Be specific about kg savings.`;
  }

  return `You are EcoTrace, a carbon footprint coach for users in India.
Return JSON only with this exact shape:
{
  "tips": [
    {
      "id": "short-kebab-id",
      "category": "Transport|Food|Energy|Shopping",
      "title": "specific action title",
      "savingKg": 120,
      "difficulty": "Easy|Medium|Hard",
      "body": "one sentence practical explanation"
    }
  ]
}
Create exactly ${MAX_TIPS} personalized tips. Prioritize the highest footprint categories and avoid guilt-heavy language.
User profile:
${JSON.stringify(profile, null, 2)}${userContext}`;
}

/**
 * Normalizes a raw AI-generated tip, falling back to static data for
 * any missing or invalid fields.
 *
 * @param {Object|null|undefined} tip - The raw tip object from Gemini.
 * @param {number} index - Index within the tips array (used for fallback cycling).
 * @returns {{ id: string, category: string, title: string, savingKg: number, difficulty: string, body: string }}
 *   A validated, safe-to-render tip object.
 */
export function normalizeTip(tip, index) {
  const fallback = FALLBACK_TIPS[index % FALLBACK_TIPS.length];
  const category = ["Transport", "Food", "Energy", "Shopping"].includes(tip?.category)
    ? tip.category
    : fallback.category;
  const difficulty = ["Easy", "Medium", "Hard"].includes(tip?.difficulty) ? tip.difficulty : fallback.difficulty;
  return {
    id: String(tip?.id || fallback.id || `ai-tip-${index}`).slice(0, MAX_TIP_ID_LENGTH),
    category,
    title: String(tip?.title || fallback.title).slice(0, MAX_TIP_TITLE_LENGTH),
    savingKg: Math.max(MIN_SAVING_KG, Math.round(Number(tip?.savingKg || fallback.savingKg || DEFAULT_SAVING_KG))),
    difficulty,
    body: String(tip?.body || fallback.body).slice(0, MAX_TIP_BODY_LENGTH),
  };
}

/**
 * Parses raw Gemini API response data into an array of normalized tips.
 * Strips markdown code-fence wrappers if present.
 *
 * @param {Object} data - The raw JSON response from the Gemini API.
 * @returns {Array<Object>} An array of normalized tip objects (max {@link MAX_TIPS}).
 */
export function parseGeminiResponse(data) {
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed?.tips) ? parsed.tips.map(normalizeTip).slice(0, MAX_TIPS) : FALLBACK_TIPS;
}

/* ── Exported API ──────────────────────────────────────────────── */

/**
 * Returns the static fallback tips, normalized through the same pipeline
 * as AI-generated tips to guarantee consistent structure.
 *
 * @returns {Array<Object>} Up to {@link MAX_TIPS} normalized fallback tip objects.
 */
export function getFallbackTips() {
  return FALLBACK_TIPS.map(normalizeTip).slice(0, MAX_TIPS);
}

/**
 * Fetches personalized carbon-saving tips from the Gemini AI service.
 * Falls back to static tips when the service is unavailable or returns
 * an error.
 *
 * @param {Object} profile - The user's carbon-footprint profile data.
 * @returns {Promise<{ source: "gemini-proxy"|"gemini-api"|"fallback", tips: Array<Object>, message?: string }>}
 *   An object containing the tip source, the tips array, and an optional user-facing message.
 */
export async function getPersonalizedTips(profile) {
  if (!hasGeminiConfig()) {
    return {
      source: "fallback",
      tips: getFallbackTips(),
      message: "Gemini is not configured yet, so EcoTrace is showing curated starter tips.",
    };
  }

  const prompt = buildPrompt(profile);
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      responseMimeType: "application/json",
    },
    model: ECO_CONFIG.gemini.model,
  };

  /* ── 1. Try the Netlify serverless proxy first ──────────────────── */
  try {
    const proxyRes = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return { source: "gemini-proxy", tips: parseGeminiResponse(data) };
    }
    /* Non-OK status → fall through to next strategy */
  } catch {
    /* Network error (e.g. running locally without Netlify) → fall through */
  }

  /* ── 2. Try the configured proxy endpoint (if any) ──────────────── */
  try {
    if (ECO_CONFIG.gemini.proxyEndpoint) {
      const response = await fetch(ECO_CONFIG.gemini.proxyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prompt }),
      });
      if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
      const data = await response.json();
      const tips = Array.isArray(data.tips)
        ? data.tips.map(normalizeTip).slice(0, MAX_TIPS)
        : parseGeminiResponse(data);
      return { source: "gemini-proxy", tips };
    }
  } catch (error) {
    logWarn('gemini', 'Configured proxy failed, trying direct API', error);
  }

  /* ── 3. No proxy available — use static fallback tips ──────────── */
  return {
    source: "fallback",
    tips: getFallbackTips(),
    message: "Gemini proxy not configured. EcoTrace used static fallback tips.",
  };
}

/* ── Internal Gemini proxy helper ─────────────────────────────── */

/**
 * Sends a raw text prompt to the Gemini proxy and returns the response text.
 * Tries the Netlify function first, then the configured proxy endpoint.
 *
 * @param {string} prompt - The text prompt to send to Gemini.
 * @returns {Promise<string>} The raw text content from Gemini's response.
 * @throws {Error} If all proxy strategies fail.
 */
async function callGeminiProxy(prompt) {
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      responseMimeType: "application/json",
    },
    model: ECO_CONFIG.gemini.model,
  };

  /* Try Netlify serverless proxy */
  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    }
  } catch { /* fall through */ }

  /* Try configured proxy endpoint */
  if (ECO_CONFIG.gemini.proxyEndpoint) {
    const res = await fetch(ECO_CONFIG.gemini.proxyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    }
  }

  throw new Error("All Gemini proxy strategies failed");
}

/* ── Reduction Goals ──────────────────────────────────────────── */

/**
 * Returns static fallback reduction goals, optionally reordered to
 * prioritize the user's highest-emission category.
 *
 * @param {Array<[string, number]>} [categories] - Sorted category entries.
 * @returns {Array<{goal: string, savings: string, category: string}>}
 */
function getDefaultGoals(categories) {
  const goals = [
    { goal: 'Use public transport 3 days/week instead of driving', savings: '520 kg/year', category: 'Transport' },
    { goal: 'Have 2 meatless days per week', savings: '320 kg/year', category: 'Food' },
    { goal: 'Switch to LED bulbs and reduce AC by 2°C', savings: '280 kg/year', category: 'Energy' },
  ];
  if (categories && categories.length > 0) {
    const highest = categories[0][0];
    goals.sort((a, b) => {
      if (a.category.toLowerCase() === highest) return -1;
      if (b.category.toLowerCase() === highest) return 1;
      return 0;
    });
  }
  return goals;
}

/**
 * Generates personalized carbon reduction goals using the Gemini API.
 * Falls back to static goals if the API is unavailable.
 *
 * @param {number} totalKg - User's total annual carbon footprint in kg.
 * @param {Object} breakdown - Category breakdown {transport, food, energy, shopping}.
 * @returns {Promise<Array<{goal: string, savings: string, category: string}>>}
 */
export async function generateReductionGoals(totalKg, breakdown) {
  if (!totalKg || totalKg <= 0) {
    return getDefaultGoals();
  }

  const categories = Object.entries(breakdown || {})
    .sort(([, a], [, b]) => b - a);

  const prompt = `Given a carbon footprint of ${Math.round(totalKg)} kg CO₂/year with breakdown: ${categories.map(([k, v]) => `${k}=${Math.round(v)}kg`).join(', ')}. Generate exactly 3 specific, actionable reduction goals as JSON array: [{"goal": "...", "savings": "X kg/year", "category": "..."}]. Focus on the highest category first. Be specific about actions and savings.`;

  if (!hasGeminiConfig()) {
    return getDefaultGoals(categories);
  }

  try {
    const raw = await callGeminiProxy(prompt);
    const parsed = JSON.parse(raw.replace(/```json?|```/g, '').trim());
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
  } catch {
    logWarn('gemini', 'Reduction goals generation failed, using defaults');
  }

  return getDefaultGoals(categories);
}

