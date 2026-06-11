import { ECO_CONFIG } from "./config.js?v=firebase-config-21";
import { appState, buildEmptyState, clamp, formatDate, formatKg, onUserReady } from "./app.js?v=firebase-config-21";
import { ecoService } from "./firebase.js?v=firebase-config-21";

let breakdownChart;
let trendChart;

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(280, rect.width || canvas.parentElement?.clientWidth || 320);
  const height = Math.max(240, rect.height || canvas.parentElement?.clientHeight || 300);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawFallbackDonut(canvas, latest) {
  if (!canvas || !latest?.breakdown) return;
  const { ctx, width, height } = prepareCanvas(canvas);
  const values = [
    ["Transport", latest.breakdown.transport || 0, "#2f7c64"],
    ["Food", latest.breakdown.food || 0, "#a7c957"],
    ["Energy", latest.breakdown.energy || 0, "#f4a261"],
    ["Shopping", latest.breakdown.shopping || 0, "#395c6b"],
  ];
  const total = values.reduce((sum, [, value]) => sum + value, 0) || 1;
  const radius = Math.min(width, height) * 0.28;
  const centerX = width / 2;
  const centerY = height * 0.42;
  let angle = -Math.PI / 2;
  values.forEach(([, value, color]) => {
    const nextAngle = angle + (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, nextAngle);
    ctx.lineWidth = radius * 0.42;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.stroke();
    angle = nextAngle;
  });
  ctx.fillStyle = "#1e3029";
  ctx.font = "700 26px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(total).toLocaleString()} kg`, centerX, centerY + 8);
  ctx.font = "700 13px Source Sans 3, sans-serif";
  values.forEach(([label, value, color], index) => {
    const x = 28 + (index % 2) * (width / 2);
    const y = height - 70 + Math.floor(index / 2) * 28;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 10, 14, 14);
    ctx.fillStyle = "#405a4e";
    ctx.textAlign = "left";
    ctx.fillText(`${label}: ${Math.round(value).toLocaleString()} kg`, x + 22, y + 2);
  });
}

function drawFallbackLine(canvas, footprints) {
  if (!canvas || !footprints.length) return;
  const { ctx, width, height } = prepareCanvas(canvas);
  const chronological = [...footprints].reverse().slice(-8);
  const padding = { top: 28, right: 24, bottom: 54, left: 56 };
  const values = chronological.map((item) => Number(item.totalKg || 0));
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.05;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pointFor = (value, index) => {
    const x = padding.left + (chronological.length === 1 ? 0 : (index / (chronological.length - 1)) * plotWidth);
    const y = padding.top + (1 - (value - min) / Math.max(max - min, 1)) * plotHeight;
    return { x, y };
  };

  ctx.strokeStyle = "rgba(30, 48, 41, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (i / 4) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const points = values.map(pointFor);
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#2f7c64";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.lineTo(points[points.length - 1].x, padding.top + plotHeight);
  ctx.lineTo(points[0].x, padding.top + plotHeight);
  ctx.closePath();
  ctx.fillStyle = "rgba(47, 124, 100, 0.12)";
  ctx.fill();

  ctx.fillStyle = "#f4a261";
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#66786e";
  ctx.font = "700 12px Source Sans 3, sans-serif";
  ctx.textAlign = "center";
  chronological.forEach((item, index) => {
    const point = pointFor(values[index], index);
    const label = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(item.date || item.createdAt));
    ctx.fillText(label, point.x, height - 22);
  });
}

function sortFootprints(records) {
  return [...records].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function renderMetricCards(latest) {
  const annual = latest?.totalKg || 0;
  setText("[data-score-today]", `${Math.round(annual / 365).toLocaleString()} kg`);
  setText("[data-score-week]", `${Math.round(annual / 52).toLocaleString()} kg`);
  setText("[data-score-month]", `${Math.round(annual / 12).toLocaleString()} kg`);
  setText("[data-dashboard-total]", `${annual.toLocaleString()} kg/year`);
}

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

function renderBreakdownChart(latest) {
  const canvas = document.getElementById("breakdownChart");
  if (!canvas || !latest?.breakdown) return;
  if (!window.Chart) {
    drawFallbackDonut(canvas, latest);
    return;
  }
  breakdownChart?.destroy();
  breakdownChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Transport", "Food", "Energy", "Shopping"],
      datasets: [
        {
          data: [
            latest.breakdown.transport || 0,
            latest.breakdown.food || 0,
            latest.breakdown.energy || 0,
            latest.breakdown.shopping || 0,
          ],
          backgroundColor: ["#2f7c64", "#a7c957", "#f4a261", "#395c6b"],
          borderColor: "#f8f4e8",
          borderWidth: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#23332d", font: { family: "Source Sans 3" } } },
      },
      cutout: "64%",
    },
  });
}

function renderTrendChart(footprints) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  if (!window.Chart) {
    drawFallbackLine(canvas, footprints);
    return;
  }
  const chronological = [...footprints].reverse().slice(-8);
  trendChart?.destroy();
  trendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: chronological.map((item) =>
        new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(item.date || item.createdAt)),
      ),
      datasets: [
        {
          label: "kg CO₂/year",
          data: chronological.map((item) => item.totalKg),
          fill: true,
          borderColor: "#2f7c64",
          backgroundColor: "rgba(47, 124, 100, 0.16)",
          tension: 0.35,
          pointBackgroundColor: "#f4a261",
          pointBorderColor: "#23332d",
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: "#50645b" }, grid: { display: false } },
        y: { ticks: { color: "#50645b" }, grid: { color: "rgba(35, 51, 45, 0.08)" } },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

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

async function renderDashboard(user, profile) {
  const [footprints, activities] = await Promise.all([ecoService.getFootprints(user), ecoService.getActivities(user)]);
  const sorted = sortFootprints(footprints);
  const latest = sorted[0];
  renderMetricCards(latest);
  renderCityComparison(latest);
  renderBreakdownChart(latest);
  renderTrendChart(sorted);
  renderActivityLog(activities);
  setText("[data-streak-days]", `${profile?.streak || 5}-day reduction streak!`);
  setText("[data-dashboard-points]", `${Number(profile?.greenPoints || 0).toLocaleString()} points`);
  setText("[data-dashboard-saved]", formatKg(profile?.co2Saved || 0));
}

onUserReady((user, profile) => {
  renderDashboard(user || appState.user, profile || appState.profile).catch((error) => {
    console.error(error);
    document.querySelector("[data-dashboard-error]")?.removeAttribute("hidden");
  });
});
