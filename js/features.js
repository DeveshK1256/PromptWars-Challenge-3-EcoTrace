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
  el.replaceChildren();
  offsets.forEach(o => {
    const card = document.createElement('div');
    card.className = 'offset-card';
    const emoji = document.createElement('span');
    emoji.className = 'offset-emoji';
    emoji.textContent = o.emoji;
    const num = document.createElement('div');
    num.className = 'offset-number';
    num.dataset.count = o.value;
    num.textContent = '0';
    const label = document.createElement('div');
    label.className = 'offset-label';
    label.textContent = o.label;
    card.append(emoji, num, label);
    el.append(card);
  });

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

  el.replaceChildren();

  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'heatmap-months';
  months.forEach(m => {
    const span = document.createElement('span');
    span.textContent = m;
    monthsDiv.append(span);
  });

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
    const ds = c.date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.level = c.level;
    cell.title = `${ds}: ${c.level} actions`;
    gridDiv.append(cell);
  });

  containerDiv.append(daysDiv, gridDiv);

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

  el.append(monthsDiv, containerDiv, statsDiv, legendDiv);
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
      try { n.stop?.(); n.disconnect(); } catch { /* node already stopped */ }
    });
    nodes = [];
    if (ctx) { ctx.close(); ctx = null; }
  }

  /**
   * Sets the ambient-sounds button icon and label text.
   * @param {string} icon - FontAwesome icon name suffix.
   * @param {string} text - Button label text.
   */
  function setAmbientLabel(icon, text) {
    btn.replaceChildren();
    const i = document.createElement('i');
    i.className = `fa-solid fa-${icon}`;
    i.setAttribute('aria-hidden', 'true');
    btn.append(i, ` ${text}`);
  }

  btn.addEventListener("click", () => {
    if (playing) {
      stop();
      btn.classList.remove("active");
      setAmbientLabel('volume-xmark', 'Nature Sounds');
    } else {
      start();
      btn.classList.add("active");
      setAmbientLabel('volume-high', 'Nature Sounds');
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
    el.replaceChildren();
    pledges.forEach((p, i) => {
      const article = document.createElement('article');
      article.className = 'pledge-card';

      const textDiv = document.createElement('div');
      textDiv.className = 'pledge-text';
      textDiv.textContent = `${p.emoji} "${p.text}"`;

      const footer = document.createElement('div');
      footer.className = 'pledge-footer';

      const authorSpan = document.createElement('span');
      authorSpan.className = 'pledge-author';
      authorSpan.textContent = `\u2014 ${p.author}`;

      const likeBtn = document.createElement('button');
      likeBtn.className = `pledge-like${p.liked ? ' liked' : ''}`;
      likeBtn.dataset.pledgeIdx = i;
      const heartIcon = document.createElement('i');
      heartIcon.className = `fa-${p.liked ? 'solid' : 'regular'} fa-heart`;
      likeBtn.append(heartIcon, ` ${p.likes}`);

      likeBtn.addEventListener('click', () => {
        pledges[i].liked = !pledges[i].liked;
        pledges[i].likes += pledges[i].liked ? 1 : -1;
        localStorage.setItem(PLEDGES_KEY, JSON.stringify(pledges));
        render();
      });

      footer.append(authorSpan, likeBtn);
      article.append(textDiv, footer);
      el.append(article);
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

  el.replaceChildren();
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'compare-row';
    row.style.animationDelay = `${i * 0.08}s`;

    const label = document.createElement('div');
    label.className = 'compare-label';
    label.textContent = `${e.flag} ${e.label}`;

    const barTrack = document.createElement('div');
    barTrack.className = 'compare-bar-track';
    const barFill = document.createElement('div');
    barFill.className = `compare-bar-fill ${e.cls}`.trim();
    barFill.style.inlineSize = '0%';
    barFill.dataset.width = (e.kg / max * 100).toFixed(1);
    barTrack.append(barFill);

    const value = document.createElement('div');
    value.className = 'compare-value';
    value.textContent = `${e.kg.toLocaleString()} kg`;

    row.append(label, barTrack, value);
    el.append(row);
  });

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
