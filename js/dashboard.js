/**
 * @module dashboard
 * User dashboard rendering — footprint history chart (Chart.js),
 * summary statistics, activity timeline, and score comparisons.
 */
import { ECO_CONFIG } from "./config.js";
import { appState, buildEmptyState, clamp, formatDate, formatKg, onUserReady, showToast } from "./app.js";
import { ecoService } from "./firebase.js";
import { logError } from "./logger.js";
import { renderBreakdownChart, renderTrendChart } from "./dashboard-charts.js";

/**
 * Sorts an array of footprint records by date in descending order (newest first).
 * @param {Array<Object>} records - Footprint records with `date` or `createdAt` fields.
 * @returns {Array<Object>} A new array of records sorted newest-first.
 */
function sortFootprints(records) {
  return [...records].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

/**
 * Sets the text content of all elements matching a CSS selector.
 * @param {string} selector - A CSS selector string to match target elements.
 * @param {string} value - The text content to assign to each matched element.
 * @returns {void}
 */
function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

/**
 * Renders the daily, weekly, monthly, and annual metric cards from the latest footprint.
 * @param {Object|undefined} latest - The most recent footprint result.
 * @param {number} [latest.totalKg=0] - Total annual CO₂ in kilograms.
 * @returns {void}
 */
function renderMetricCards(latest) {
  const annual = latest?.totalKg || 0;
  setText("[data-score-today]", `${Math.round(annual / 365).toLocaleString()} kg`);
  setText("[data-score-week]", `${Math.round(annual / 52).toLocaleString()} kg`);
  setText("[data-score-month]", `${Math.round(annual / 12).toLocaleString()} kg`);
  setText("[data-dashboard-total]", `${annual.toLocaleString()} kg/year`);
}

/**
 * Renders the city-average comparison bar and label, showing how the user's
 * footprint compares to the configured city average.
 * @param {Object|undefined} latest - The most recent footprint result.
 * @param {number} [latest.totalKg=0] - Total annual CO₂ in kilograms.
 * @returns {void}
 */
function renderCityComparison(latest) {
  const total = latest?.totalKg || 0;
  const ratio = clamp((total / ECO_CONFIG.app.cityAverageKg) * 100, 4, 140);
  const bar = document.querySelector("[data-city-progress]");
  const label = document.querySelector("[data-city-label]");
  if (bar) bar.style.inlineSize = `${Math.min(ratio, 100)}%`;
  if (label) {
    const difference = total - ECO_CONFIG.app.cityAverageKg;
    label.textContent =
      difference <= 0
        ? `${Math.abs(difference).toLocaleString()} kg below the city average`
        : `${difference.toLocaleString()} kg above the city average`;
  }
}

/**
 * Renders the user's activity timeline, showing up to 8 recent entries.
 * Displays an empty state when no activities exist.
 * @param {Array<{ message: string, createdAt: string }>} activities - Activity records to display.
 * @returns {void}
 */
function renderActivityLog(activities) {
  const list = document.querySelector("[data-activity-log]");
  if (!list) return;
  list.replaceChildren();
  if (!activities.length) {
    list.append(buildEmptyState("No activity yet", "Save a footprint, accept a challenge, or read an article to start your log."));
    return;
  }
  activities.slice(0, 8).forEach((activity) => {
    const item = document.createElement("li");
    item.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = "activity-dot";
    icon.setAttribute("aria-hidden", "true");
    const content = document.createElement("span");
    content.textContent = activity.message;
    const time = document.createElement("time");
    time.dateTime = activity.createdAt;
    time.textContent = formatDate(activity.createdAt);
    item.append(icon, content, time);
    list.append(item);
  });
}

/**
 * Downloads footprint history as a CSV file.
 * @param {Array<Object>} footprints - Array of footprint records.
 * @returns {void}
 */
function exportCSV(footprints) {
  if (!footprints?.length) { showToast('No data to export yet.'); return; }
  const headers = ['Date', 'Total (kg)', 'Transport', 'Food', 'Energy', 'Shopping'];
  const rows = footprints.map(f => [
    f.date || 'N/A',
    f.totalKg || 0,
    f.breakdown?.transport || 0,
    f.breakdown?.food || 0,
    f.breakdown?.energy || 0,
    f.breakdown?.shopping || 0,
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ecotrace-footprint-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Footprint history exported as CSV.');
}

/**
 * Renders a monthly trend comparison message.
 * @param {Array<Object>} footprints - Sorted footprint records (newest first).
 * @returns {void}
 */
function renderMonthlyTrend(footprints) {
  const panel = document.querySelector('[data-monthly-comparison]');
  const text = document.querySelector('[data-monthly-text]');
  if (!panel || !text || footprints.length < 2) return;
  const latest = footprints[0].totalKg;
  const previous = footprints[1].totalKg;
  const diff = previous - latest;
  const pct = Math.abs(Math.round((diff / previous) * 100));
  if (diff > 0) {
    text.textContent = `Great job! You reduced your footprint by ${pct}%`
      + ` (${Math.abs(diff).toLocaleString()} kg) compared to your previous calculation.`;
    text.style.color = 'var(--forest)';
  } else if (diff < 0) {
    text.textContent = `Your footprint increased by ${pct}%`
      + ` (${Math.abs(diff).toLocaleString()} kg) since your last calculation.`
      + ` Try the tips page for ideas!`;
    text.style.color = 'var(--danger)';
  } else {
    text.textContent = 'Your footprint is the same as your last calculation.';
  }
  panel.hidden = false;
}

/**
 * Generates and renders personalised reduction goals based on the user's
 * highest-emitting category from their latest footprint calculation.
 * @param {Array<Object>} footprints - Sorted footprint records.
 * @returns {void}
 */
function renderReductionGoals(footprints) {
  const panel = document.querySelector('[data-reduction-goals]');
  const grid = document.querySelector('[data-goals-grid]');
  if (!panel || !grid || !footprints.length) return;

  const latest = footprints[0];
  const breakdown = latest.breakdown || {};
  const goals = [];

  if (breakdown.transport > 800) {
    goals.push({
      icon: '🚌',
      title: 'Switch to Public Transport',
      target: `Reduce transport emissions by ${Math.round(breakdown.transport * 0.3).toLocaleString()} kg`,
      action: 'Use bus/metro 3 days a week instead of driving.',
    });
  }
  if (breakdown.food > 1200) {
    goals.push({
      icon: '🥗',
      title: 'Add 2 Meat-Free Days',
      target: `Reduce food emissions by ${Math.round(breakdown.food * 0.15).toLocaleString()} kg`,
      action: 'Try vegetarian meals on Monday and Thursday.',
    });
  }
  if (breakdown.energy > 800) {
    goals.push({
      icon: '💡',
      title: 'Cut Energy Use by 20%',
      target: `Save ${Math.round(breakdown.energy * 0.2).toLocaleString()} kg CO₂`,
      action: 'Switch off AC 2 hours earlier, use LED lighting.',
    });
  }
  if (breakdown.shopping > 600) {
    goals.push({
      icon: '♻️',
      title: 'Reduce Shopping Footprint',
      target: `Save ${Math.round(breakdown.shopping * 0.25).toLocaleString()} kg CO₂`,
      action: 'Buy second-hand, bundle online orders, extend device life.',
    });
  }
  // Always show at least one goal
  if (!goals.length) {
    goals.push({
      icon: '🌱',
      title: 'Maintain Your Low Footprint',
      target: `Keep emissions under ${(latest.totalKg || 4000).toLocaleString()} kg`,
      action: 'Great job! Keep tracking monthly to stay on target.',
    });
  }

  grid.replaceChildren();
  goals.forEach(g => {
    const card = document.createElement('article');
    card.className = 'goal-card';
    const icon = document.createElement('span');
    icon.className = 'goal-icon';
    icon.textContent = g.icon;
    const title = document.createElement('h3');
    title.textContent = g.title;
    const target = document.createElement('p');
    target.className = 'goal-target';
    target.textContent = g.target;
    const action = document.createElement('p');
    action.className = 'muted';
    action.textContent = g.action;
    card.append(icon, title, target, action);
    grid.append(card);
  });
  panel.hidden = false;
}

/**
 * Fetches footprint history and activity log, then renders the complete
 * dashboard: metric cards, city comparison, charts, activity log,
 * monthly trend, CSV export, streak, points, and CO₂ saved.
 * @param {Object} user - The authenticated Firebase user object.
 * @param {Object} profile - The user's EcoTrace profile data.
 * @returns {Promise<void>} Resolves when the dashboard has been fully rendered.
 * @throws {Error} If fetching footprints or activities from Firestore fails.
 */
async function renderDashboard(user, profile) {
  const [footprints, activities] = await Promise.all([ecoService.getFootprints(user), ecoService.getActivities(user)]);
  const sorted = sortFootprints(footprints);
  const latest = sorted[0];
  renderMetricCards(latest);
  renderCityComparison(latest);
  renderBreakdownChart(latest);
  renderTrendChart(sorted);
  renderActivityLog(activities);
  renderMonthlyTrend(sorted);
  renderReductionGoals(sorted);
  document.querySelector('[data-export-csv]')?.addEventListener('click', () => exportCSV(sorted));
  setText("[data-streak-days]", `${profile?.streak || 5}-day reduction streak!`);
  setText("[data-dashboard-points]", `${Number(profile?.greenPoints || 0).toLocaleString()} points`);
  setText("[data-dashboard-saved]", formatKg(profile?.co2Saved || 0));
}

onUserReady((user, profile) => {
  renderDashboard(user || appState.user, profile || appState.profile).catch((error) => {
    logError('dashboard', error);
    document.querySelector("[data-dashboard-error]")?.removeAttribute("hidden");
  });
});
