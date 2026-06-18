/**
 * @module gamification
 * Advanced gamification system — Levels, Daily Missions, Streak Rewards.
 * Persists progress in localStorage alongside existing Green Points.
 */

/* ── Levels ────────────────────────────────────────────────────────── */

/** @type {Array<{id: string, label: string, icon: string, minPoints: number, color: string}>} */
export const LEVELS = [
  { id: "beginner",  label: "Eco Beginner",    icon: "🌱", minPoints: 0,    color: "#a7c957" },
  { id: "explorer",  label: "Eco Explorer",    icon: "🌿", minPoints: 100,  color: "#2f7c64" },
  { id: "champion",  label: "Green Champion",  icon: "🌳", minPoints: 300,  color: "#1a5c3a" },
  { id: "hero",      label: "Climate Hero",    icon: "🌍", minPoints: 600,  color: "#0d3b26" },
  { id: "legend",    label: "Earth Legend",     icon: "⭐", minPoints: 1000, color: "#f4a261" },
];

/**
 * Returns the current level for a given point total.
 * @param {number} points
 * @returns {typeof LEVELS[0]}
 */
export function getLevelForPoints(points) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

/**
 * Returns progress to next level (0–1).
 * @param {number} points
 * @returns {{ current: typeof LEVELS[0], next: typeof LEVELS[0]|null, progress: number }}
 */
export function getLevelProgress(points) {
  const current = getLevelForPoints(points);
  const idx = LEVELS.indexOf(current);
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  if (!next) return { current, next: null, progress: 1 };
  const range = next.minPoints - current.minPoints;
  const earned = points - current.minPoints;
  return { current, next, progress: Math.min(1, earned / range) };
}

/* ── Daily Missions ────────────────────────────────────────────────── */

/** @type {Array<{id: string, label: string, icon: string, points: number, category: string}>} */
const ALL_MISSIONS = [
  { id: "walk-2km",        label: "Walk at least 2 km today",          icon: "fa-person-walking", points: 10, category: "Transport" },
  { id: "public-transit",  label: "Use public transport today",        icon: "fa-bus",            points: 10, category: "Transport" },
  { id: "no-car",          label: "Don't use a car today",             icon: "fa-car-side",       points: 15, category: "Transport" },
  { id: "meatless-meal",   label: "Have a meatless meal",              icon: "fa-leaf",           points: 10, category: "Food" },
  { id: "local-food",      label: "Buy locally sourced food",          icon: "fa-store",          points: 10, category: "Food" },
  { id: "no-food-waste",   label: "Zero food waste today",             icon: "fa-recycle",        points: 15, category: "Food" },
  { id: "lights-off",      label: "Turn off lights when leaving",      icon: "fa-lightbulb",      points: 5,  category: "Energy" },
  { id: "cold-wash",       label: "Wash clothes in cold water",        icon: "fa-tshirt",         points: 10, category: "Energy" },
  { id: "unplug-chargers", label: "Unplug chargers when not in use",   icon: "fa-plug",           points: 5,  category: "Energy" },
  { id: "reuse-bag",       label: "Use a reusable bag",                icon: "fa-bag-shopping",   points: 5,  category: "Shopping" },
  { id: "no-online-order", label: "Skip online shopping today",        icon: "fa-cart-shopping",  points: 10, category: "Shopping" },
  { id: "repair-item",     label: "Repair instead of replace",         icon: "fa-wrench",         points: 20, category: "Shopping" },
];

/** Number of daily missions to present */
const DAILY_MISSION_COUNT = 3;

/**
 * Gets today's daily missions (seeded by date for consistency).
 * @returns {typeof ALL_MISSIONS}
 */
export function getDailyMissions() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = localStorage.getItem("ecotrace.dailyMissions");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) return parsed.missions;
    } catch { /* regenerate */ }
  }

  // Seeded shuffle based on date
  const seed = today.split("-").reduce((a, b) => a + Number(b), 0);
  const shuffled = [...ALL_MISSIONS].sort((a, b) => {
    const ha = (seed * 31 + a.id.length) % 100;
    const hb = (seed * 31 + b.id.length) % 100;
    return ha - hb;
  });

  const missions = shuffled.slice(0, DAILY_MISSION_COUNT);
  localStorage.setItem("ecotrace.dailyMissions", JSON.stringify({ date: today, missions }));
  return missions;
}

/**
 * Gets completed mission IDs for today.
 * @returns {Set<string>}
 */
export function getCompletedMissions() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem("ecotrace.completedMissions") || "{}");
    if (stored.date === today) return new Set(stored.ids || []);
  } catch { /* reset */ }
  return new Set();
}

/**
 * Marks a mission as completed and awards points.
 * @param {string} missionId
 * @returns {number} Points awarded (0 if already completed).
 */
export function completeMission(missionId) {
  const completed = getCompletedMissions();
  if (completed.has(missionId)) return 0;

  const mission = ALL_MISSIONS.find((m) => m.id === missionId);
  if (!mission) return 0;

  completed.add(missionId);
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem("ecotrace.completedMissions", JSON.stringify({ date: today, ids: [...completed] }));

  // Award points
  const currentPoints = Number(localStorage.getItem("greenPoints")) || 0;
  localStorage.setItem("greenPoints", String(currentPoints + mission.points));
  // Notify listeners (e.g. analytics) — avoids circular deps with firebase.js
  window.dispatchEvent(new CustomEvent("eco:mission-complete", {
    detail: { missionId, points: mission.points },
  }));

  return mission.points;
}

/* ── Streaks ───────────────────────────────────────────────────────── */

/** @type {Array<{days: number, label: string, icon: string, bonusPoints: number}>} */
export const STREAK_MILESTONES = [
  { days: 7,   label: "7-day streak",   icon: "🔥",  bonusPoints: 50 },
  { days: 30,  label: "30-day streak",  icon: "💪",  bonusPoints: 200 },
  { days: 100, label: "100-day streak", icon: "🏆", bonusPoints: 500 },
];

/**
 * Gets the current streak data.
 * @returns {{ currentStreak: number, longestStreak: number, lastActive: string }}
 */
export function getStreakData() {
  try {
    const stored = JSON.parse(localStorage.getItem("ecotrace.streak") || "{}");
    return {
      currentStreak: stored.currentStreak || 0,
      longestStreak: stored.longestStreak || 0,
      lastActive: stored.lastActive || "",
    };
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastActive: "" };
  }
}

/**
 * Records today's activity and updates the streak.
 * @returns {{ streak: number, milestone: typeof STREAK_MILESTONES[0]|null }}
 */
export function recordDailyActivity() {
  const today = new Date().toISOString().slice(0, 10);
  const data = getStreakData();

  if (data.lastActive === today) {
    return { streak: data.currentStreak, milestone: null };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = data.lastActive === yesterday ? data.currentStreak + 1 : 1;
  const longest = Math.max(data.longestStreak, newStreak);

  localStorage.setItem("ecotrace.streak", JSON.stringify({
    currentStreak: newStreak,
    longestStreak: longest,
    lastActive: today,
  }));

  // Check milestones
  const milestone = STREAK_MILESTONES.find((m) => m.days === newStreak) || null;
  if (milestone) {
    const pts = Number(localStorage.getItem("greenPoints")) || 0;
    localStorage.setItem("greenPoints", String(pts + milestone.bonusPoints));
  }

  return { streak: newStreak, milestone };
}

/* ── DOM Rendering ─────────────────────────────────────────────────── */

/**
 * Renders the level progress bar.
 * @param {HTMLElement} container
 * @param {number} points
 */
export function renderLevelProgress(container, points) {
  if (!container) return;
  container.textContent = "";

  const { current, next, progress } = getLevelProgress(points);

  const wrapper = document.createElement("div");
  wrapper.className = "level-display";

  const levelIcon = document.createElement("span");
  levelIcon.className = "level-icon";
  levelIcon.textContent = current.icon;

  const levelLabel = document.createElement("strong");
  levelLabel.className = "level-label";
  levelLabel.textContent = current.label;
  levelLabel.style.color = current.color;

  const progressBar = document.createElement("div");
  progressBar.className = "level-progress-track";
  const fill = document.createElement("div");
  fill.className = "level-progress-fill";
  fill.style.width = `${Math.round(progress * 100)}%`;
  fill.style.background = current.color;
  progressBar.append(fill);

  const progressText = document.createElement("span");
  progressText.className = "level-progress-text muted";
  progressText.textContent = next
    ? `${points} / ${next.minPoints} points to ${next.label}`
    : `Max level reached! (${points} points)`;

  wrapper.append(levelIcon, levelLabel, progressBar, progressText);
  container.append(wrapper);
}

/**
 * Renders daily missions.
 * @param {HTMLElement} container
 */
export function renderDailyMissions(container) {
  if (!container) return;
  container.textContent = "";

  const missions = getDailyMissions();
  const completed = getCompletedMissions();

  missions.forEach((mission) => {
    const card = document.createElement("div");
    card.className = `mission-card${completed.has(mission.id) ? " mission-completed" : ""}`;

    const icon = document.createElement("i");
    icon.className = `fa-solid ${mission.icon}`;
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "mission-label";
    label.textContent = mission.label;

    const pts = document.createElement("span");
    pts.className = "mission-points";
    pts.textContent = `+${mission.points} pts`;

    const btn = document.createElement("button");
    btn.className = "btn btn-small";
    btn.type = "button";
    if (completed.has(mission.id)) {
      btn.textContent = "✓ Done";
      btn.disabled = true;
      btn.classList.add("btn-secondary");
    } else {
      btn.textContent = "Complete";
      btn.classList.add("btn-primary");
      btn.addEventListener("click", () => {
        const awarded = completeMission(mission.id);
        if (awarded > 0) {
          recordDailyActivity();
          renderDailyMissions(container);
          // Update wallet if visible
          const wallet = document.querySelector("[data-green-points]");
          if (wallet) wallet.textContent = localStorage.getItem("greenPoints") || "0";
        }
      });
    }

    card.append(icon, label, pts, btn);
    container.append(card);
  });
}

/**
 * Renders streak display.
 * @param {HTMLElement} container
 */
export function renderStreakDisplay(container) {
  if (!container) return;
  container.textContent = "";

  const data = getStreakData();

  const wrapper = document.createElement("div");
  wrapper.className = "streak-display";

  const current = document.createElement("div");
  current.className = "streak-stat";
  const fireIcon = document.createElement("span");
  fireIcon.textContent = "🔥";
  fireIcon.className = "streak-icon";
  const streakNum = document.createElement("strong");
  streakNum.textContent = String(data.currentStreak);
  streakNum.className = "streak-number";
  const streakLabel = document.createElement("span");
  streakLabel.textContent = "day streak";
  streakLabel.className = "streak-label muted";
  current.append(fireIcon, streakNum, streakLabel);

  const longest = document.createElement("div");
  longest.className = "streak-stat";
  const trophyIcon = document.createElement("span");
  trophyIcon.textContent = "🏆";
  trophyIcon.className = "streak-icon";
  const longestNum = document.createElement("strong");
  longestNum.textContent = String(data.longestStreak);
  longestNum.className = "streak-number";
  const longestLabel = document.createElement("span");
  longestLabel.textContent = "longest";
  longestLabel.className = "streak-label muted";
  longest.append(trophyIcon, longestNum, longestLabel);

  wrapper.append(current, longest);

  // Milestone badges
  const milestones = document.createElement("div");
  milestones.className = "streak-milestones";
  STREAK_MILESTONES.forEach((m) => {
    const badge = document.createElement("span");
    badge.className = `streak-badge${data.longestStreak >= m.days ? " streak-badge-earned" : ""}`;
    badge.textContent = `${m.icon} ${m.label}`;
    badge.title = `+${m.bonusPoints} bonus points`;
    milestones.append(badge);
  });

  container.append(wrapper, milestones);
}
