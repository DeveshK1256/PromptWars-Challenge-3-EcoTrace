/**
 * @module heatmap
 * GitHub-style 52-week × 7-day eco-streak heatmap for the EcoTrace
 * application.  Reads cached activity data from localStorage, computes
 * per-day CO₂ totals, and renders a colour-coded grid with streak
 * counters, month labels, day labels, and a legend.
 */

/* ───────── Named Constants ───────── */

/** @const {string} localStorage key for cached activity data. */
const ACTIVITIES_CACHE_KEY = "eco-activities-cache";

/**
 * @const {string[]} Colour stops for heatmap cells, from no-activity
 * through maximum intensity (inspired by GitHub contribution colours).
 */
const HEATMAP_COLOUR_STOPS = [
  '#ebedf0',
  '#9be9a8',
  '#40c463',
  '#30a14e',
  '#216e39',
];

/** @const {number} Number of days rendered in the eco-streak heatmap. */
const HEATMAP_DAYS = 365;

/* ===== ECO STREAK HEATMAP ===== */

/**
 * Groups an array of activity objects by ISO date (YYYY-MM-DD) and
 * returns a Map whose keys are date strings and values are the total
 * CO₂ (kg) recorded on that date.
 *
 * Only activities within the last 365 days are included.
 *
 * @param {Array<{ createdAt: string, co2Kg?: number }>} activities
 *   Raw activity objects; each should carry a parseable `createdAt`
 *   timestamp and an optional `co2Kg` numeric value.
 * @returns {Map<string, number>} ISO date → total CO₂ kg for that day.
 */
function buildHeatmapData(activities) {
  /** @type {Map<string, number>} */
  const map = new Map();
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - HEATMAP_DAYS);

  activities.forEach((a) => {
    const d = new Date(a.createdAt);
    if (d < cutoff || d > now) return;
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + (Number(a.co2Kg) || 0));
  });
  return map;
}

/**
 * Generates heatmap cell data from real cached activities, including
 * CO₂ values, colour levels, and streak counters.
 *
 * @param {number} days - Number of past days to generate.
 * @returns {{ cells: Array<{ date: Date, level: number, value: number }>,
 *            streak: number, maxStreak: number }}
 *   The cell data array together with current and longest streak lengths.
 */
function createHeatmapCells(days) {
  const raw = JSON.parse(
    localStorage.getItem(ACTIVITIES_CACHE_KEY) || '[]'
  );
  const dataMap = buildHeatmapData(raw);

  const maxValue = Math.max(...dataMap.values(), 0);

  const today = new Date();
  const cells = [];
  let maxStreak = 0;
  let currentStreak = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const value = dataMap.get(key) || 0;
    const level = maxValue > 0
      ? Math.min(
          Math.floor((value / maxValue) * (HEATMAP_COLOUR_STOPS.length - 1)),
          HEATMAP_COLOUR_STOPS.length - 1
        )
      : 0;

    cells.push({ date: d, level, value });

    if (value > 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return { cells, streak: currentStreak, maxStreak };
}

/**
 * Builds the heatmap grid element containing one div per cell.
 * Each cell receives a background colour from {@link HEATMAP_COLOUR_STOPS}
 * and a title tooltip showing the ISO date and CO₂ kg total.
 *
 * @param {Array<{ date: Date, level: number, value: number }>} cells - The cell data array.
 * @returns {HTMLDivElement} A container div with day-labels and the cell grid.
 */
function buildHeatmapGrid(cells) {
  const containerDiv = document.createElement('div');
  containerDiv.className = 'heatmap-container';

  const daysDiv = document.createElement('div');
  daysDiv.className = 'heatmap-days';
  ["", "Mon", "", "Wed", "", "Fri", ""].forEach(d => {
    const span = document.createElement('span');
    span.textContent = d;
    daysDiv.append(span);
  });

  const gridDiv = document.createElement('div');
  gridDiv.className = 'heatmap-grid';
  cells.forEach(c => {
    const isoDate = c.date.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.level = c.level;
    cell.style.backgroundColor = HEATMAP_COLOUR_STOPS[c.level];
    cell.title = `${isoDate}: ${c.value.toFixed(1)} kg CO\u2082`;
    gridDiv.append(cell);
  });

  containerDiv.append(daysDiv, gridDiv);
  return containerDiv;
}

/**
 * Builds the heatmap legend element showing activity level colours.
 * @returns {HTMLDivElement} The legend div with level-0 through level-4 cells.
 */
function buildHeatmapLegend() {
  const legendDiv = document.createElement('div');
  legendDiv.className = 'heatmap-legend';
  legendDiv.append('Less');
  for (let lvl = 0; lvl <= 4; lvl++) {
    const lc = document.createElement('div');
    lc.className = 'heatmap-legend-cell heatmap-cell';
    lc.dataset.level = lvl;
    legendDiv.append(lc);
  }
  legendDiv.append('More');
  return legendDiv;
}

/**
 * Renders a GitHub-style 52-week × 7-day activity heatmap with
 * random demo data, streak counters, and hover tooltips.
 *
 * @returns {void}
 */
export function initEcoHeatmap() {
  const el = document.querySelector("[data-eco-heatmap]");
  if (!el) return;
  const { cells, streak, maxStreak } = createHeatmapCells(HEATMAP_DAYS);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  el.replaceChildren();

  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'heatmap-months';
  months.forEach(m => {
    const span = document.createElement('span');
    span.textContent = m;
    monthsDiv.append(span);
  });

  const containerDiv = buildHeatmapGrid(cells);

  const statsDiv = document.createElement('div');
  statsDiv.className = 'heatmap-stats';
  const currentStreakDiv = document.createElement('div');
  const currentStreakStrong = document.createElement('strong');
  currentStreakStrong.textContent = `${streak} days`;
  currentStreakDiv.append('🔥 Current Streak: ', currentStreakStrong);
  const maxStreakDiv = document.createElement('div');
  const maxStreakStrong = document.createElement('strong');
  maxStreakStrong.textContent = `${maxStreak} days`;
  maxStreakDiv.append('🏆 Longest Streak: ', maxStreakStrong);
  statsDiv.append(currentStreakDiv, maxStreakDiv);

  const legendDiv = buildHeatmapLegend();

  el.append(monthsDiv, containerDiv, statsDiv, legendDiv);
}
