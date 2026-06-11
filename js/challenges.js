/**
 * @module challenges
 * Weekly eco-challenges, badge progression, and Green Points
 * leaderboard with real-time Firestore or demo-mode fallback.
 */
import { BADGES, CHALLENGES } from "./data.js?v=firebase-config-36";
import { appState, onUserReady, setButtonBusy, showToast } from "./app.js?v=firebase-config-36";
import { ecoService } from "./firebase.js?v=firebase-config-36";

const challengeGrid = document.querySelector("[data-challenge-grid]");
const badgeGrid = document.querySelector("[data-badge-grid]");
const leaderboard = document.querySelector("[data-leaderboard]");

/**
 * Updates all Green Points wallet displays across the page.
 * @param {Object|null} profile - The user's EcoTrace profile.
 * @param {number} [profile.greenPoints=0] - The user's current Green Points balance.
 * @returns {void}
 */
function updateWallet(profile) {
  document.querySelectorAll("[data-green-points]").forEach((node) => {
    node.textContent = Number(profile?.greenPoints || 0).toLocaleString();
  });
  document.querySelectorAll("[data-points-wallet]").forEach((node) => {
    node.textContent = `${Number(profile?.greenPoints || 0).toLocaleString()} Green Points`;
  });
}

/**
 * Renders weekly eco-challenge cards into the challenge grid.
 * Each card shows the challenge icon, title, description, points reward,
 * deadline, and an Accept button. Already-accepted challenges are disabled.
 * @param {Object|null} profile - The user's EcoTrace profile.
 * @param {string[]} [profile.acceptedChallenges=[]] - IDs of challenges the user has accepted.
 * @returns {void}
 */
function renderChallenges(profile) {
  if (!challengeGrid) return;
  const accepted = new Set(profile?.acceptedChallenges || []);
  challengeGrid.replaceChildren();
  CHALLENGES.forEach((challenge) => {
    const card = document.createElement("article");
    card.className = "challenge-card";
    const icon = document.createElement("i");
    icon.className = `fa-solid ${challenge.icon}`;
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("h3");
    title.textContent = challenge.title;
    const description = document.createElement("p");
    description.textContent = challenge.description;
    const meta = document.createElement("div");
    meta.className = "challenge-meta";
    const points = document.createElement("span");
    points.textContent = `+${challenge.points} Green Points`;
    const deadline = document.createElement("span");
    deadline.textContent = challenge.deadline;
    meta.append(points, deadline);
    const button = document.createElement("button");
    button.className = "btn btn-primary";
    button.type = "button";
    button.textContent = accepted.has(challenge.id) ? "Accepted" : "Accept";
    button.disabled = accepted.has(challenge.id);
    button.addEventListener("click", async () => {
      setButtonBusy(button, true, "Accepting...");
      try {
        const result = await ecoService.acceptChallenge(appState.user, challenge);
        appState.profile = result.profile;
        updateWallet(appState.profile);
        renderChallenges(appState.profile);
        renderBadges(appState.profile);
        await renderLeaderboard(appState.user);
        showToast(result.awarded ? `Challenge accepted. +${challenge.points} points!` : "Challenge already accepted.");
      } catch (error) {
        console.error(error);
        showToast("Challenge could not be accepted.", "error");
      } finally {
        setButtonBusy(button, false);
      }
    });
    card.append(icon, title, description, meta, button);
    challengeGrid.append(card);
  });
}

/**
 * Renders badge progression cards showing the user's progress toward each badge threshold.
 * Displays unlock status and a progress bar for each badge.
 * @param {Object|null} profile - The user's EcoTrace profile.
 * @param {number} [profile.greenPoints=0] - The user's current Green Points balance.
 * @returns {void}
 */
function renderBadges(profile) {
  if (!badgeGrid) return;
  const points = Number(profile?.greenPoints || 0);
  badgeGrid.replaceChildren();
  BADGES.forEach((badge) => {
    const progress = Math.min(100, (points / badge.threshold) * 100);
    const card = document.createElement("article");
    card.className = "badge-card";
    const icon = document.createElement("span");
    icon.className = "badge-icon";
    icon.textContent = badge.icon;
    const title = document.createElement("h3");
    title.textContent = badge.label;
    const text = document.createElement("p");
    text.textContent = points >= badge.threshold ? "Unlocked" : `${badge.threshold - points} points to unlock`;
    const bar = document.createElement("span");
    bar.className = "progress-track";
    const fill = document.createElement("span");
    fill.className = "progress-fill";
    fill.style.inlineSize = `${progress}%`;
    bar.append(fill);
    card.append(icon, title, text, bar);
    badgeGrid.append(card);
  });
}

/**
 * Fetches the Green Points leaderboard from Firestore and renders the top 10 rows.
 * @param {Object} user - The authenticated Firebase user object.
 * @returns {Promise<void>} Resolves when the leaderboard has been rendered.
 * @throws {Error} If the Firestore leaderboard query fails.
 */
async function renderLeaderboard(user) {
  if (!leaderboard) return;
  const rows = await ecoService.getLeaderboard(user);
  leaderboard.replaceChildren();
  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;
    const name = document.createElement("strong");
    name.textContent = row.displayName || "EcoTracer";
    const points = document.createElement("span");
    points.textContent = `${Number(row.greenPoints || 0).toLocaleString()} pts`;
    item.append(rank, name, points);
    leaderboard.append(item);
  });
}

onUserReady((user, profile) => {
  updateWallet(profile);
  renderChallenges(profile);
  renderBadges(profile);
  renderLeaderboard(user).catch((error) => {
    console.error(error);
    showToast("Leaderboard could not load.", "error");
  });
});
