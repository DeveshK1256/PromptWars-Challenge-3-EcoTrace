/**
 * @module forecasting
 * AI-powered carbon footprint forecasting using Gemini.
 * Predicts future emissions and suggests highest-impact changes.
 */
import { logError } from "./logger.js";

/** Default annual footprint (kg CO₂) when no data is available. */
const DEFAULT_ANNUAL_KG = 4000;

/** Generation temperature for forecasting prompt. */
const FORECAST_TEMPERATURE = 0.3;

/** Maximum output tokens for forecast response. */
const FORECAST_MAX_TOKENS = 512;

/** Gemini model identifier for forecasting. */
const FORECAST_MODEL = "gemini-2.0-flash-lite";

/** Default percentage saving estimate. */
const DEFAULT_SAVING_RATIO = 0.14;

/** Months in a year. */
const MONTHS_PER_YEAR = 12;

/**
 * Builds a forecasting prompt from footprint history.
 * @param {Array<{totalKg: number, date: string, breakdown?: Object}>} footprints
 * @returns {string}
 */
function buildForecastPrompt(footprints) {
  const chronological = [...footprints].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  const latest = chronological[chronological.length - 1];
  const dataPoints = chronological.map((f) =>
    `${(f.date || f.createdAt || "").slice(0, 10)}: ${Math.round(f.totalKg)} kg`
  ).join(", ");

  const breakdown = latest?.breakdown
    ? `\nBreakdown: Transport ${Math.round(latest.breakdown.transport || 0)} kg, Food ${Math.round(latest.breakdown.food || 0)} kg, Energy ${Math.round(latest.breakdown.energy || 0)} kg, Shopping ${Math.round(latest.breakdown.shopping || 0)} kg.`
    : "";

  return `You are a carbon footprint analyst. Given this user's footprint history:
${dataPoints}${breakdown}

Respond in this exact JSON format:
{
  "projectedAnnualKg": <number>,
  "trendDirection": "increasing" | "decreasing" | "stable",
  "trendPercentage": <number>,
  "highestCategory": "<string>",
  "topRecommendation": "<specific action>",
  "estimatedSavingKg": <number>,
  "monthlyProjection": [<12 numbers for Jan-Dec projected kg/month>],
  "confidence": "high" | "medium" | "low"
}

Be specific. Use the actual data trends. Project 12 months forward.`;
}

/**
 * Fetches a forecast from the Gemini API.
 * @param {Array<Object>} footprints - Historical footprint records.
 * @returns {Promise<Object>} Parsed forecast data.
 */
export async function getForecast(footprints) {
  if (!footprints || footprints.length < 1) {
    return getDefaultForecast(footprints);
  }

  try {
    const prompt = buildForecastPrompt(footprints);
    const response = await fetch("/.netlify/functions/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FORECAST_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: FORECAST_TEMPERATURE, maxOutputTokens: FORECAST_MAX_TOKENS },
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logError("forecasting", error);
  }

  return getDefaultForecast(footprints);
}

/**
 * Returns a default forecast based on simple trend analysis.
 * @param {Array<Object>} footprints
 * @returns {Object}
 */
function getDefaultForecast(footprints) {
  const sorted = [...(footprints || [])].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  const latest = sorted[sorted.length - 1];
  const totalKg = latest?.totalKg || DEFAULT_ANNUAL_KG;
  const monthly = totalKg / MONTHS_PER_YEAR;

  return {
    projectedAnnualKg: totalKg,
    trendDirection: "stable",
    trendPercentage: 0,
    highestCategory: "Transport",
    topRecommendation: "Replace 3 car trips per week with public transport",
    estimatedSavingKg: Math.round(totalKg * DEFAULT_SAVING_RATIO),
    monthlyProjection: Array.from({ length: MONTHS_PER_YEAR }, () => Math.round(monthly)),
    confidence: "low",
  };
}

/**
 * Renders the forecast panel.
 * @param {HTMLElement} container
 * @param {Object} forecast
 */
export function renderForecast(container, forecast) {
  if (!container || !forecast) return;
  container.textContent = "";

  const grid = document.createElement("div");
  grid.className = "forecast-grid";

  // Trend card
  const trendCard = document.createElement("div");
  trendCard.className = "forecast-card";
  const trendIcon = forecast.trendDirection === "decreasing" ? "fa-arrow-trend-down" : forecast.trendDirection === "increasing" ? "fa-arrow-trend-up" : "fa-arrows-left-right";
  const trendColor = forecast.trendDirection === "decreasing" ? "#2f7c64" : forecast.trendDirection === "increasing" ? "#e76f51" : "#f4a261";

  const trendIconEl = document.createElement("i");
  trendIconEl.className = `fa-solid ${trendIcon}`;
  trendIconEl.style.color = trendColor;
  trendIconEl.setAttribute("aria-hidden", "true");

  const trendValue = document.createElement("strong");
  trendValue.className = "forecast-value";
  trendValue.textContent = `${forecast.trendPercentage}%`;
  trendValue.style.color = trendColor;

  const trendLabel = document.createElement("span");
  trendLabel.textContent = `Trend: ${forecast.trendDirection}`;
  trendLabel.className = "forecast-label";

  trendCard.append(trendIconEl, trendValue, trendLabel);

  // Projected card
  const projCard = document.createElement("div");
  projCard.className = "forecast-card";
  const projIcon = document.createElement("i");
  projIcon.className = "fa-solid fa-crystal-ball";
  projIcon.setAttribute("aria-hidden", "true");
  const projValue = document.createElement("strong");
  projValue.className = "forecast-value";
  projValue.textContent = `${Math.round(forecast.projectedAnnualKg).toLocaleString()} kg`;
  const projLabel = document.createElement("span");
  projLabel.textContent = "Projected annual CO₂";
  projLabel.className = "forecast-label";
  projCard.append(projIcon, projValue, projLabel);

  // Recommendation card
  const recCard = document.createElement("div");
  recCard.className = "forecast-card forecast-card-wide";
  const recIcon = document.createElement("i");
  recIcon.className = "fa-solid fa-lightbulb";
  recIcon.style.color = "#f4a261";
  recIcon.setAttribute("aria-hidden", "true");
  const recText = document.createElement("p");
  recText.className = "forecast-recommendation";
  recText.textContent = forecast.topRecommendation;
  const recSaving = document.createElement("span");
  recSaving.className = "forecast-saving";
  recSaving.textContent = `Potential saving: ${Math.round(forecast.estimatedSavingKg).toLocaleString()} kg CO₂/year`;
  recCard.append(recIcon, recText, recSaving);

  // Confidence badge
  const confBadge = document.createElement("span");
  confBadge.className = `forecast-confidence forecast-confidence-${forecast.confidence}`;
  confBadge.textContent = `${forecast.confidence} confidence`;

  grid.append(trendCard, projCard, recCard);
  container.append(grid, confBadge);

  // Draw monthly projection chart
  if (forecast.monthlyProjection?.length === 12) {
    const chartWrap = document.createElement("div");
    chartWrap.className = "forecast-chart";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const maxVal = Math.max(...forecast.monthlyProjection) || 1;

    forecast.monthlyProjection.forEach((val, i) => {
      const bar = document.createElement("div");
      bar.className = "forecast-bar";
      const fill = document.createElement("div");
      fill.className = "forecast-bar-fill";
      fill.style.height = `${Math.round((val / maxVal) * 100)}%`;
      const mo = document.createElement("span");
      mo.className = "forecast-bar-label";
      mo.textContent = months[i];
      const kg = document.createElement("span");
      kg.className = "forecast-bar-value";
      kg.textContent = `${Math.round(val)}`;
      bar.append(fill, kg, mo);
      chartWrap.append(bar);
    });

    container.append(chartWrap);
  }
}
