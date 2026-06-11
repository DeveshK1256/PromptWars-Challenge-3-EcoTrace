/**
 * @module gemini
 * Gemini AI integration for the EcoTrace application.
 * Builds prompts from user profiles, calls the Gemini API (or a proxy),
 * normalizes the response, and falls back to static tips on failure.
 */

import { ECO_CONFIG, hasGeminiConfig } from "./config.js?v=firebase-config-34";
import { FALLBACK_TIPS } from "./data.js?v=firebase-config-34";

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

/* ── Internal helpers ──────────────────────────────────────────── */

/**
 * Builds the Gemini prompt string for a given user profile.
 *
 * @param {Object} profile - The user's carbon-footprint profile data.
 * @returns {string} A complete prompt instructing Gemini to return JSON tips.
 */
function buildPrompt(profile) {
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
${JSON.stringify(profile, null, 2)}`;
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
function normalizeTip(tip, index) {
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
function parseGeminiResponse(data) {
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

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(ECO_CONFIG.gemini.model)}` +
      `:generateContent?key=${encodeURIComponent(ECO_CONFIG.gemini.apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: GEMINI_TEMPERATURE,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const data = await response.json();
    return { source: "gemini-api", tips: parseGeminiResponse(data) };
  } catch (error) {
    console.warn("EcoTrace Gemini fallback used", error);
    return {
      source: "fallback",
      tips: getFallbackTips(),
      message: "Gemini tips could not load right now, so EcoTrace used static fallback tips.",
    };
  }
}

