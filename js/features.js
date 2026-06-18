/**
 * @module features
 * Five core UI features for the EcoTrace application: Dark Mode,
 * Earth Vitals ticker, Carbon Time Machine, Offset Visualizer,
 * and Ambient Nature Sounds.
 * Each exported function checks for its DOM container before running,
 * making it safe to import on any page.
 *
 * The Offset Visualizer and Ambient Nature Sounds implementations live
 * in the companion {@link module:features-extras} module and are
 * re-exported here for backward compatibility.
 */

import { initEcoHeatmap, initShareCard, initPledgeWall, initFootprintComparison } from './features-social.js';
import { initOffsetVisualizer, initAmbientSounds } from './features-extras.js';
export { initOffsetVisualizer, initAmbientSounds };

// Feature modules for dashboard/calculator/challenges pages
import { renderEquivalences } from './impact-equivalences.js';
import { getForecast, renderForecast } from './forecasting.js';
import { renderLevelProgress, renderDailyMissions, renderStreakDisplay } from './gamification.js';
import { renderTeamLeaderboard, renderCreateTeamForm } from './team-challenges.js';

/* ───────── Named Constants ───────── */

/** @const {number} Upper PPM bound used for the time-machine progress bar. */
const MAX_PPM = 500;

/** @const {string} localStorage key for dark-mode preference. */
const DARK_MODE_KEY = "eco-dark-mode";

/* ===== 1. DARK / ECO MODE ===== */

/**
 * Initialises the dark-mode (eco-mode) toggle.
 * Reads saved preference from localStorage and respects
 * `prefers-color-scheme: dark`. Toggles `data-theme="dark"` on `<html>`.
 *
 * @returns {void}
 */
export function initDarkMode() {
  const btn = document.querySelector("[data-darkmode-toggle]");
  if (!btn) return;

  /** Sets the dark-mode toggle button icon. */
  function setIcon(icon) {
    btn.replaceChildren();
    const i = document.createElement('i');
    i.className = `fa-solid fa-${icon}`;
    i.setAttribute('aria-hidden', 'true');
    btn.append(i);
  }

  const saved = localStorage.getItem(DARK_MODE_KEY);
  if (saved === "true" || (!saved && matchMedia("(prefers-color-scheme:dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
    setIcon('sun');
  }
  btn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      setIcon('moon');
      localStorage.setItem(DARK_MODE_KEY, "false");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      setIcon('sun');
      localStorage.setItem(DARK_MODE_KEY, "true");
    }
  });
}

/* ===== 2. EARTH VITALS TICKER ===== */

/**
 * Renders a horizontally scrolling marquee of live Earth environmental
 * statistics (global temperature, ice loss, CO₂ concentration, etc.).
 *
 * @returns {void}
 */
export function initEarthVitals() {
  const el = document.querySelector("[data-earth-vitals]");
  if (!el) return;
  const stats = [
    { emoji: "🌡️", label: "Global Temp", value: "+1.2°C" },
    { emoji: "🧊", label: "Arctic Ice Loss", value: "13%/decade" },
    { emoji: "🌳", label: "Forest Loss", value: "10M ha/year" },
    { emoji: "🌊", label: "Sea Level Rise", value: "3.7mm/year" },
    { emoji: "☁️", label: "CO₂ Level", value: "424 ppm" },
    { emoji: "🔥", label: "Extreme Weather", value: "+50% since 2000" },
    { emoji: "🐾", label: "Species at Risk", value: "1M threatened" },
    { emoji: "🏭", label: "Emissions/Year", value: "37.4 Gt CO₂" },
  ];
  const track = document.createElement('div');
  track.className = 'vitals-track';
  const createItems = () => stats.map(s => {
    const span = document.createElement('span');
    span.className = 'vitals-item';
    const emoji = document.createElement('span');
    emoji.className = 'vitals-emoji';
    emoji.textContent = s.emoji;
    const val = document.createElement('span');
    val.className = 'vitals-value';
    val.textContent = s.value;
    span.append(emoji, ` ${s.label}: `, val);
    return span;
  });
  track.append(...createItems(), ...createItems());
  el.replaceChildren(track);
}

/* ===== 3. CARBON TIME MACHINE ===== */

/**
 * Interactive slider showing atmospheric CO₂ concentration from 1750 to 2025.
 * Interpolates between known data points and colour-codes the result
 * from green (safe) through to red (crisis).
 *
 * @returns {void}
 */
export function initTimeMachine() {
  const el = document.querySelector("[data-time-machine]");
  if (!el) return;
  const data = [
    [1750, 280], [1800, 283], [1850, 285], [1900, 296], [1950, 311],
    [1970, 325], [1990, 354], [2000, 369], [2010, 389], [2015, 401],
    [2020, 414], [2023, 421], [2025, 424],
  ];

  /**
   * Linearly interpolates CO₂ ppm for a given year.
   * @param {number} year - Year between 1750 and 2025.
   * @returns {number} Estimated CO₂ concentration in ppm.
   */
  function getPPM(year) {
    for (let i = 0; i < data.length - 1; i++) {
      if (year >= data[i][0] && year <= data[i + 1][0]) {
        const t = (year - data[i][0]) / (data[i + 1][0] - data[i][0]);
        return Math.round(data[i][1] + t * (data[i + 1][1] - data[i][1]));
      }
    }
    return year <= 1750 ? 280 : 424;
  }

  /**
   * Returns a human-readable era label for a given year.
   * @param {number} y - Calendar year.
   * @returns {string} Era name.
   */
  function getEra(y) {
    if (y < 1800) return "Pre-Industrial";
    if (y < 1900) return "Industrial Revolution";
    if (y < 1970) return "Modern Era";
    if (y < 2010) return "Digital Age";
    return "Climate Crisis";
  }

  /**
   * Maps a CO₂ ppm value to a CSS colour.
   * @param {number} ppm - Parts per million.
   * @returns {string} Hex colour code.
   */
  function getColor(ppm) {
    if (ppm < 300) return "#2f7c64";
    if (ppm < 350) return "#a7c957";
    if (ppm < 400) return "#f4a261";
    return "#dc7f5b";
  }

  el.replaceChildren();

  const yearDiv = document.createElement('div');
  yearDiv.className = 'time-machine-year';
  yearDiv.setAttribute('data-tm-year', '');
  yearDiv.textContent = '2025';

  const eraDiv = document.createElement('div');
  eraDiv.className = 'time-machine-era';
  eraDiv.setAttribute('data-tm-era', '');
  eraDiv.textContent = 'Climate Crisis';

  const ppmDiv = document.createElement('div');
  ppmDiv.className = 'time-machine-ppm';
  ppmDiv.setAttribute('data-tm-ppm', '');
  ppmDiv.textContent = '424 ppm';

  const barDiv = document.createElement('div');
  barDiv.className = 'time-machine-bar';
  const fillDiv = document.createElement('div');
  fillDiv.className = 'time-machine-fill';
  fillDiv.setAttribute('data-tm-fill', '');
  barDiv.append(fillDiv);

  const rangeInput = document.createElement('input');
  rangeInput.type = 'range';
  rangeInput.min = '1750';
  rangeInput.max = '2025';
  rangeInput.value = '2025';
  rangeInput.step = '1';
  rangeInput.setAttribute('aria-label', 'Select year');

  const labelsDiv = document.createElement('div');
  labelsDiv.className = 'time-machine-labels';
  ['1750', '1900', '2025'].forEach(txt => {
    const span = document.createElement('span');
    span.textContent = txt;
    labelsDiv.append(span);
  });

  el.append(yearDiv, eraDiv, ppmDiv, barDiv, rangeInput, labelsDiv);

  const slider = el.querySelector("input");
  const yearEl = el.querySelector("[data-tm-year]");
  const eraEl = el.querySelector("[data-tm-era]");
  const ppmEl = el.querySelector("[data-tm-ppm]");
  const fillEl = el.querySelector("[data-tm-fill]");

  /** Updates all UI elements to reflect the current slider position. */
  function update() {
    const y = Number(slider.value);
    const ppm = getPPM(y);
    const color = getColor(ppm);
    yearEl.textContent = y;
    eraEl.textContent = getEra(y);
    ppmEl.textContent = `${ppm  } ppm`;
    ppmEl.style.color = color;
    fillEl.style.inlineSize = `${(ppm / MAX_PPM) * 100  }%`;
    fillEl.style.background = `linear-gradient(90deg, #2f7c64, ${color})`;
  }
  slider.addEventListener("input", update);
  update();
}

/* ===== AUTO-INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
  initEarthVitals();
  initTimeMachine();
  initOffsetVisualizer();
  initEcoHeatmap();
  initShareCard();
  initAmbientSounds();
  initPledgeWall();
  initFootprintComparison();

  // ── Equivalences (dashboard + calculator) ──
  try {
    const equivContainer = document.querySelector('[data-dashboard-equivalences]')
      || document.querySelector('[data-impact-equivalences]');
    if (equivContainer) {
      const co2 = Number(localStorage.getItem('lastFootprintKg')) || 4000;
      renderEquivalences(equivContainer, co2);
      // Re-render when calculator saves new result
      window.addEventListener('storage', (e) => {
        if (e.key === 'lastFootprintKg') {
          renderEquivalences(equivContainer, Number(e.newValue) || 4000);
        }
      });
    }
  } catch (e) { console.error('Equivalences init failed:', e); }

  // ── Forecast (dashboard) ──
  const forecastPanel = document.querySelector('[data-forecast-panel]');
  if (forecastPanel) {
    (async () => {
      try {
        const co2 = Number(localStorage.getItem('lastFootprintKg')) || 4000;
        const stored = JSON.parse(sessionStorage.getItem('ecotrace.footprints') || '[]');
        const forecast = await getForecast(stored.length ? stored : [{ totalKg: co2, date: new Date().toISOString() }]);
        renderForecast(forecastPanel, forecast);
      } catch (e) { console.error('Forecast init failed:', e); }
    })();
  }

  // ── Gamification (challenges) ──
  try {
    const levelEl = document.querySelector('[data-level-progress]');
    if (levelEl) {
      const pts = Number(localStorage.getItem('greenPoints')) || 0;
      renderLevelProgress(levelEl, pts);
    }
  } catch (e) { console.error('Level render failed:', e); }

  try {
    const missionsEl = document.querySelector('[data-daily-missions]');
    if (missionsEl) renderDailyMissions(missionsEl);
  } catch (e) { console.error('Missions render failed:', e); }

  try {
    const streakEl = document.querySelector('[data-streak-display]');
    if (streakEl) renderStreakDisplay(streakEl);
  } catch (e) { console.error('Streak render failed:', e); }

  // ── Team Challenges ──
  try {
    const teamLb = document.querySelector('[data-team-leaderboard]');
    if (teamLb) {
      renderTeamLeaderboard(teamLb);
      renderCreateTeamForm(document.querySelector('[data-create-team]'), teamLb);
    }
  } catch (e) { console.error('Team render failed:', e); }
});
