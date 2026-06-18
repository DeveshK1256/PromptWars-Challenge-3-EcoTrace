/**
 * @module features-social
 * Three social and community-facing UI features for the EcoTrace
 * application: Share Score Card, Pledge Wall, and Footprint Comparison.
 * The Eco Streak Heatmap has been extracted to {@link module:heatmap}
 * and is re-exported here for backward compatibility.
 * Each exported function checks for its DOM container before running,
 * making it safe to import on any page.
 */

import { initEcoHeatmap } from './heatmap.js';
export { initEcoHeatmap };

/* ───────── Named Constants ───────── */

/** @const {number} Default annual footprint when no calculation exists (kg CO₂). */
const DEFAULT_FOOTPRINT_KG = 4000;

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

  // Read data from DOM first (profile page), fall back to localStorage (dashboard)
  const saved = document.querySelector("[data-stat-saved]")?.textContent
    || `${Number(localStorage.getItem("lastFootprintKg") || 0).toLocaleString()} kg`;
  const points = document.querySelector("[data-stat-points]")?.textContent
    || String(Number(localStorage.getItem("greenPoints") || 0));
  const badgeCount = document.querySelector("[data-stat-badges]")?.textContent
    || String(Number(localStorage.getItem("ecotrace.badgeCount") || 0));

  ctx.fillStyle = "#4ecb8e";
  ctx.font = "bold 48px 'Space Grotesk',sans-serif";
  ctx.fillText(saved, 32, 145);

  ctx.fillStyle = "#b8cfc2";
  ctx.font = "16px sans-serif";
  ctx.fillText("CO₂ Saved", 32, 170);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px 'Space Grotesk',sans-serif";
  ctx.fillText(points, 32, 225);
  ctx.fillText(badgeCount, 220, 225);

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ecotrace-scorecard.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
