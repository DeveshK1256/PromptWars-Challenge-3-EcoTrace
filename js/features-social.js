/**
 * @module features-social
 * Four social and community-facing UI features for the EcoTrace application:
 * Eco Streak Heatmap, Share Score Card, Pledge Wall, and Footprint Comparison.
 * Each exported function checks for its DOM container before running,
 * making it safe to import on any page.
 */

/* ───────── Named Constants ───────── */

/** @const {number} Default annual footprint when no calculation exists (kg CO₂). */
const DEFAULT_FOOTPRINT_KG = 4000;

/** @const {number} Number of days rendered in the eco-streak heatmap. */
const HEATMAP_DAYS = 365;

/** @const {number} Share-card canvas width in pixels. */
const CANVAS_WIDTH = 600;

/** @const {number} Share-card canvas height in pixels. */
const CANVAS_HEIGHT = 340;

/** @const {number} Delay before comparison bars start animating (ms). */
const COMPARISON_ANIMATE_DELAY_MS = 200;

/** @const {string} localStorage key for saved pledges. */
const PLEDGES_KEY = "eco-pledges";

/** @const {string} localStorage key for last calculated footprint. */
const FOOTPRINT_KEY = "lastFootprintKg";

/* ===== 5. ECO STREAK HEATMAP ===== */

/**
 * Generates heatmap cell data with activity levels and streak counters.
 * @param {number} days - Number of past days to generate.
 * @returns {{ cells: Array<{ date: Date, level: number }>, streak: number, maxStreak: number }}
 *   The cell data array together with current and longest streak lengths.
 */
function createHeatmapCells(days) {
  const today = new Date();
  const cells = [];
  let maxStreak = 0, currentStreak = 0;

  for (let i = days - 1; i >= 0; i--) {
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
  return { cells, streak: currentStreak, maxStreak };
}

/**
 * Builds the heatmap grid element containing one div per cell.
 * @param {Array<{ date: Date, level: number }>} cells - The cell data array.
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

/* ===== 6. SHARE SCORE CARD ===== */

/**
 * Draws the branded score-card content onto a canvas 2D context.
 * Renders the gradient background, decorative circle, branding text,
 * CO₂ saved, Green Points, badge count, and the current date.
 * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @returns {void}
 */
function drawScoreCard(ctx, width, height) {
  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, "#1d5d4b");
  grd.addColorStop(1, "#0d1a15");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

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
}

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
    drawScoreCard(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ecotrace-scorecard.png";
      a.click();
      URL.revokeObjectURL(a.href);
    });
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

  /**
   * Creates a single pledge card article element.
   * @param {{ emoji: string, text: string, author: string, likes: number, liked?: boolean }} pledge - The pledge data object.
   * @param {number} index - The pledge's index in the pledges array.
   * @param {function(): void} onLike - Callback invoked when the like button is clicked.
   * @returns {HTMLElement} The fully constructed pledge card article.
   */
  function createPledgeCard(pledge, index, onLike) {
    const article = document.createElement('article');
    article.className = 'pledge-card';

    const textDiv = document.createElement('div');
    textDiv.className = 'pledge-text';
    textDiv.textContent = `${pledge.emoji} "${pledge.text}"`;

    const footer = document.createElement('div');
    footer.className = 'pledge-footer';

    const authorSpan = document.createElement('span');
    authorSpan.className = 'pledge-author';
    authorSpan.textContent = `\u2014 ${pledge.author}`;

    const likeBtn = document.createElement('button');
    likeBtn.className = `pledge-like${pledge.liked ? ' liked' : ''}`;
    likeBtn.dataset.pledgeIdx = index;
    const heartIcon = document.createElement('i');
    heartIcon.className = `fa-${pledge.liked ? 'solid' : 'regular'} fa-heart`;
    likeBtn.append(heartIcon, ` ${pledge.likes}`);

    likeBtn.addEventListener('click', onLike);

    footer.append(authorSpan, likeBtn);
    article.append(textDiv, footer);
    return article;
  }

  /** Re-renders all pledge cards and wires up like buttons. */
  function render() {
    el.replaceChildren();
    pledges.forEach((p, i) => {
      const card = createPledgeCard(p, i, () => {
        pledges[i].liked = !pledges[i].liked;
        pledges[i].likes += pledges[i].liked ? 1 : -1;
        localStorage.setItem(PLEDGES_KEY, JSON.stringify(pledges));
        render();
      });
      el.append(card);
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
      bar.style.inlineSize = `${bar.dataset.width  }%`;
    });
  }, COMPARISON_ANIMATE_DELAY_MS);
}
