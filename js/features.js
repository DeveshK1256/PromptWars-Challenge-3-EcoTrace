/**
 * @module features
 * Nine self-contained UI features for the EcoTrace application.
 * Each exported function checks for its DOM container before running,
 * making it safe to import on any page.
 */

/* ───────── Named Constants ───────── */

/** @const {number} Default annual footprint when no calculation exists (kg CO₂). */
const DEFAULT_FOOTPRINT_KG = 4000;

/** @const {number} Kilograms of CO₂ absorbed by one tree per year. */
const KG_PER_TREE = 22;

/** @const {number} Kilograms of CO₂ offset by one residential solar panel per year. */
const KG_PER_SOLAR_PANEL = 450;

/** @const {number} Kilograms of CO₂ saved by switching one bulb to LED per year. */
const KG_PER_LED = 36;

/** @const {number} Average km of cycling to offset 1 kg CO₂ vs driving. */
const KM_PER_KG_CYCLING = 2.3;

/** @const {number} Number of days rendered in the eco-streak heatmap. */
const HEATMAP_DAYS = 365;

/** @const {number} Upper PPM bound used for the time-machine progress bar. */
const MAX_PPM = 500;

/** @const {number} Share-card canvas width in pixels. */
const CANVAS_WIDTH = 600;

/** @const {number} Share-card canvas height in pixels. */
const CANVAS_HEIGHT = 340;

/** @const {number} Master gain for the ambient nature-sounds oscillator. */
const AMBIENT_GAIN = 0.03;

/** @const {number} Auto-stop timeout for ambient sounds (30 minutes). */
const AMBIENT_AUTO_STOP_MS = 30 * 60 * 1000;

/** @const {number} Interval between count-up animation frames (ms). */
const COUNTUP_INTERVAL_MS = 30;

/** @const {number} Total animation steps for the count-up numbers. */
const COUNTUP_STEPS = 40;

/** @const {number} Delay before comparison bars start animating (ms). */
const COMPARISON_ANIMATE_DELAY_MS = 200;

/** @const {string} localStorage key for dark-mode preference. */
const DARK_MODE_KEY = "eco-dark-mode";

/** @const {string} localStorage key for saved pledges. */
const PLEDGES_KEY = "eco-pledges";

/** @const {string} localStorage key for last calculated footprint. */
const FOOTPRINT_KEY = "lastFootprintKg";

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
  const saved = localStorage.getItem(DARK_MODE_KEY);
  if (saved === "true" || (!saved && matchMedia("(prefers-color-scheme:dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
    btn.innerHTML = '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
  }
  btn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      btn.innerHTML = '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
      localStorage.setItem(DARK_MODE_KEY, "false");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      btn.innerHTML = '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
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
  const items = stats.map(s =>
    `<span class="vitals-item">
      <span class="vitals-emoji">${s.emoji}</span>
      ${s.label}: <span class="vitals-value">${s.value}</span>
    </span>`
  ).join("");
  el.innerHTML = `<div class="vitals-track">${items}${items}</div>`;
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

  el.innerHTML = `
    <div class="time-machine-year" data-tm-year>2025</div>
    <div class="time-machine-era" data-tm-era>Climate Crisis</div>
    <div class="time-machine-ppm" data-tm-ppm>424 ppm</div>
    <div class="time-machine-bar">
      <div class="time-machine-fill" data-tm-fill></div>
    </div>
    <input type="range" min="1750" max="2025" value="2025" step="1"
           aria-label="Select year">
    <div class="time-machine-labels">
      <span>1750</span><span>1900</span><span>2025</span>
    </div>`;

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
    ppmEl.textContent = ppm + " ppm";
    ppmEl.style.color = color;
    fillEl.style.inlineSize = ((ppm / MAX_PPM) * 100) + "%";
    fillEl.style.background = `linear-gradient(90deg, #2f7c64, ${color})`;
  }
  slider.addEventListener("input", update);
  update();
}

/* ===== 4. OFFSET VISUALIZER ===== */

/**
 * Calculates and renders animated cards showing how many trees,
 * solar panels, LED bulbs, and cycling km are needed to offset
 * the user's annual carbon footprint.
 *
 * @returns {void}
 */
export function initOffsetVisualizer() {
  const el = document.querySelector("[data-offset-viz]");
  if (!el) return;
  const kg = Number(localStorage.getItem(FOOTPRINT_KEY)) || DEFAULT_FOOTPRINT_KG;
  const offsets = [
    { emoji: "🌳", value: Math.ceil(kg / KG_PER_TREE), label: "Trees needed for 1 year" },
    { emoji: "☀️", value: Math.ceil(kg / KG_PER_SOLAR_PANEL), label: "Solar panels for 1 year" },
    { emoji: "💡", value: Math.ceil(kg / KG_PER_LED), label: "LED bulbs to switch" },
    { emoji: "🚲", value: Math.ceil(kg / KM_PER_KG_CYCLING / 365), label: "km cycling daily" },
  ];
  el.innerHTML = offsets.map(o => `
    <div class="offset-card">
      <span class="offset-emoji">${o.emoji}</span>
      <div class="offset-number" data-count="${o.value}">0</div>
      <div class="offset-label">${o.label}</div>
    </div>`
  ).join("");

  el.querySelectorAll("[data-count]").forEach(num => {
    const target = Number(num.dataset.count);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / COUNTUP_STEPS));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      num.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, COUNTUP_INTERVAL_MS);
  });
}

/* ===== 5. ECO STREAK HEATMAP ===== */

/**
 * Renders a GitHub-style 52-week × 7-day activity heatmap with
 * random demo data, streak counters, and hover tooltips.
 *
 * @returns {void}
 */
export function initEcoHeatmap() {
  const el = document.querySelector("[data-eco-heatmap]");
  if (!el) return;
  const today = new Date();
  const cells = [];
  let maxStreak = 0, currentStreak = 0;

  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const level = i < 7
      ? Math.floor(Math.random() * 3) + 1
      : Math.floor(Math.random() * 5);
    cells.push({ date: d, level });
    if (level > 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  const streak = currentStreak;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels = months.map(m => `<span>${m}</span>`).join("");
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]
    .map(d => `<span>${d}</span>`).join("");

  const grid = cells.map(c => {
    const ds = c.date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    return `<div class="heatmap-cell" data-level="${c.level}"
                 title="${ds}: ${c.level} actions"></div>`;
  }).join("");

  el.innerHTML = `
    <div class="heatmap-months">${monthLabels}</div>
    <div class="heatmap-container">
      <div class="heatmap-days">${dayLabels}</div>
      <div class="heatmap-grid">${grid}</div>
    </div>
    <div class="heatmap-stats">
      <div>🔥 Current Streak: <strong>${streak} days</strong></div>
      <div>🏆 Longest Streak: <strong>${maxStreak} days</strong></div>
    </div>
    <div class="heatmap-legend">
      Less
      <div class="heatmap-legend-cell heatmap-cell" data-level="0"></div>
      <div class="heatmap-legend-cell heatmap-cell" data-level="1"></div>
      <div class="heatmap-legend-cell heatmap-cell" data-level="2"></div>
      <div class="heatmap-legend-cell heatmap-cell" data-level="3"></div>
      <div class="heatmap-legend-cell heatmap-cell" data-level="4"></div>
      More
    </div>`;
}

/* ===== 6. SHARE SCORE CARD ===== */

/**
 * Generates a downloadable PNG score-card canvas showing the user's
 * CO₂ saved, Green Points, and badge count, with a branded gradient.
 *
 * @returns {void}
 */
export function initShareCard() {
  const btn = document.querySelector("[data-share-card]");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    const grd = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    grd.addColorStop(0, "#1d5d4b");
    grd.addColorStop(1, "#0d1a15");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(167,201,87,0.08)";
    ctx.beginPath();
    ctx.arc(480, 60, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px 'Space Grotesk',sans-serif";
    ctx.fillText("🌍 EcoTrace", 32, 50);

    ctx.fillStyle = "#a7c957";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("MY CARBON SCORECARD", 32, 80);

    const saved = document.querySelector("[data-stat-saved]")?.textContent || "0 kg";
    const points = document.querySelector("[data-stat-points]")?.textContent || "0";
    const badges = document.querySelector("[data-stat-badges]")?.textContent || "0";

    ctx.fillStyle = "#4ecb8e";
    ctx.font = "bold 48px 'Space Grotesk',sans-serif";
    ctx.fillText(saved, 32, 145);

    ctx.fillStyle = "#b8cfc2";
    ctx.font = "16px sans-serif";
    ctx.fillText("CO₂ Saved", 32, 170);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px 'Space Grotesk',sans-serif";
    ctx.fillText(points, 32, 225);
    ctx.fillText(badges, 220, 225);

    ctx.fillStyle = "#8ba99a";
    ctx.font = "14px sans-serif";
    ctx.fillText("Green Points", 32, 248);
    ctx.fillText("Badges Earned", 220, 248);

    ctx.fillStyle = "#536b5e";
    ctx.font = "12px sans-serif";
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
    ctx.fillText(dateStr, 32, 310);
    ctx.fillText("eco-tracee.netlify.app", 32, 328);

    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ecotrace-scorecard.png";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });
}

/* ===== 7. AMBIENT NATURE SOUNDS ===== */

/**
 * Creates a Web Audio context that plays soft brown-noise wind
 * and random sine-wave bird chirps. Toggles on/off and auto-stops
 * after {@link AMBIENT_AUTO_STOP_MS} milliseconds.
 *
 * @returns {void}
 */
export function initAmbientSounds() {
  const btn = document.querySelector("[data-ambient-toggle]");
  if (!btn) return;
  let ctx = null, playing = false, nodes = [];

  /** Builds the audio graph and starts playback. */
  function start() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = AMBIENT_GAIN;
    gain.connect(ctx.destination);

    const bufSize = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    noise.connect(filter);
    filter.connect(gain);
    noise.start();
    nodes.push(noise, filter, gain);

    /** Schedules a random bird-chirp oscillator burst. */
    function chirp() {
      if (!playing) return;
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 2000 + Math.random() * 2000;
      g2.gain.value = 0;
      g2.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.05);
      g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.connect(g2);
      g2.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(chirp, 3000 + Math.random() * 8000);
    }
    setTimeout(chirp, 1000 + Math.random() * 3000);
    playing = true;
    setTimeout(() => { if (playing) stop(); }, AMBIENT_AUTO_STOP_MS);
  }

  /** Tears down all audio nodes and closes the context. */
  function stop() {
    playing = false;
    nodes.forEach(n => {
      try { n.stop?.(); n.disconnect(); } catch (_e) { /* node already stopped */ }
    });
    nodes = [];
    if (ctx) { ctx.close(); ctx = null; }
  }

  btn.addEventListener("click", () => {
    if (playing) {
      stop();
      btn.classList.remove("active");
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i> Nature Sounds';
    } else {
      start();
      btn.classList.add("active");
      btn.innerHTML = '<i class="fa-solid fa-volume-high" aria-hidden="true"></i> Nature Sounds';
    }
  });
}

/* ===== 8. ECO PLEDGE WALL ===== */

/**
 * Renders a community pledge wall with pre-populated eco-pledges.
 * Users can like pledges and submit their own (persisted in localStorage).
 *
 * @returns {void}
 */
export function initPledgeWall() {
  const el = document.querySelector("[data-pledge-wall]");
  if (!el) return;
  const defaultPledges = [
    { text: "I pledge to use public transport 3x/week", author: "Amit, Delhi", emoji: "🚌", likes: 47 },
    { text: "Going plastic-free for 30 days", author: "Sara, Mumbai", emoji: "♻️", likes: 82 },
    { text: "Switching to solar energy this year", author: "Ravi, Chennai", emoji: "☀️", likes: 65 },
    { text: "Planting 10 trees every month", author: "Priya, Bangalore", emoji: "🌱", likes: 91 },
    { text: "Zero food waste challenge accepted", author: "Neha, Pune", emoji: "🍽️", likes: 38 },
    { text: "Car-free weekends forever!", author: "Vikram, Hyderabad", emoji: "🚶", likes: 56 },
    { text: "Only buying second-hand clothes", author: "Anita, Kolkata", emoji: "👗", likes: 44 },
    { text: "Composting all kitchen waste", author: "Karthik, Jaipur", emoji: "🪱", likes: 73 },
  ];
  const pledges = JSON.parse(localStorage.getItem(PLEDGES_KEY) || "null") || defaultPledges;

  /** Re-renders all pledge cards and wires up like buttons. */
  function render() {
    el.innerHTML = pledges.map((p, i) => `
      <article class="pledge-card">
        <div class="pledge-text">${p.emoji} "${p.text}"</div>
        <div class="pledge-footer">
          <span class="pledge-author">\u2014 ${p.author}</span>
          <button class="pledge-like ${p.liked ? "liked" : ""}"
                  data-pledge-idx="${i}">
            <i class="fa-${p.liked ? "solid" : "regular"} fa-heart"></i> ${p.likes}
          </button>
        </div>
      </article>`
    ).join("");

    el.querySelectorAll(".pledge-like").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.pledgeIdx);
        pledges[idx].liked = !pledges[idx].liked;
        pledges[idx].likes += pledges[idx].liked ? 1 : -1;
        localStorage.setItem(PLEDGES_KEY, JSON.stringify(pledges));
        render();
      });
    });
  }
  render();

  const form = document.querySelector("[data-pledge-form]");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const input = form.querySelector("input");
      if (!input.value.trim()) return;
      pledges.unshift({
        text: input.value.trim(), author: "You",
        emoji: "✊", likes: 1, liked: true,
      });
      localStorage.setItem(PLEDGES_KEY, JSON.stringify(pledges));
      input.value = "";
      render();
    });
  }
}

/* ===== 9. FOOTPRINT COMPARISON ===== */

/**
 * Renders an animated horizontal bar chart comparing the user's
 * carbon footprint against country averages and the Paris Agreement target.
 *
 * @returns {void}
 */
export function initFootprintComparison() {
  const el = document.querySelector("[data-footprint-compare]");
  if (!el) return;
  const userKg = Number(localStorage.getItem(FOOTPRINT_KEY)) || DEFAULT_FOOTPRINT_KG;
  const entries = [
    { flag: "🎯", label: "Paris Goal", kg: 2100, cls: "target-bar" },
    { flag: "🇮🇳", label: "India Avg", kg: 1900, cls: "" },
    { flag: "👤", label: "Your Score", kg: userKg, cls: "user-bar" },
    { flag: "🌍", label: "World Avg", kg: 4700, cls: "" },
    { flag: "🇬🇧", label: "UK Avg", kg: 5200, cls: "" },
    { flag: "🇩🇪", label: "Germany Avg", kg: 7900, cls: "" },
    { flag: "🇺🇸", label: "USA Avg", kg: 14700, cls: "" },
    { flag: "🇶🇦", label: "Qatar Avg", kg: 35600, cls: "" },
  ];
  const max = Math.max(...entries.map(e => e.kg));

  el.innerHTML = entries.map((e, i) => `
    <div class="compare-row" style="animation-delay:${i * 0.08}s">
      <div class="compare-label">${e.flag} ${e.label}</div>
      <div class="compare-bar-track">
        <div class="compare-bar-fill ${e.cls}" style="inline-size:0%"
             data-width="${(e.kg / max * 100).toFixed(1)}"></div>
      </div>
      <div class="compare-value">${e.kg.toLocaleString()} kg</div>
    </div>`
  ).join("");

  setTimeout(() => {
    el.querySelectorAll("[data-width]").forEach(bar => {
      bar.style.inlineSize = bar.dataset.width + "%";
    });
  }, COMPARISON_ANIMATE_DELAY_MS);
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
});
