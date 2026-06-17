/**
 * @module dashboard-charts
 * Chart and visualisation helpers for the EcoTrace dashboard —
 * Canvas-based fallback donut and line charts, plus Chart.js wrappers
 * for category breakdown and trend views.
 */

let breakdownChart;
let trendChart;

/**
 * Builds a visually-hidden data table summarising chart data for screen readers.
 * @param {string} caption - Table caption.
 * @param {string[]} labels - Data labels.
 * @param {number[]} values - Data values.
 * @param {string} unit - Unit suffix (e.g. 'kg CO₂').
 * @returns {HTMLTableElement} A sr-only table element.
 */
function buildChartDataTable(caption, labels, values, unit) {
  const table = document.createElement('table');
  table.className = 'sr-only';
  const cap = document.createElement('caption');
  cap.textContent = caption;
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Category', 'Value'].forEach(t => {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.textContent = t;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement('tbody');
  labels.forEach((label, i) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = label;
    const td2 = document.createElement('td');
    td2.textContent = `${Math.round(values[i]).toLocaleString()} ${unit}`;
    tr.append(td1, td2);
    tbody.append(tr);
  });
  table.append(cap, thead, tbody);
  return table;
}

/**
 * Prepares a canvas element for high-DPI rendering by setting its pixel
 * dimensions, CSS size, and returning a scaled 2D context.
 * @param {HTMLCanvasElement} canvas - The canvas element to prepare.
 * @returns {{ ctx: CanvasRenderingContext2D, width: number, height: number }} The 2D context and the logical CSS dimensions.
 */
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

/**
 * Draws a fallback donut chart on canvas when Chart.js is not available.
 * Renders category arcs, a centre total label, and a colour legend.
 * @param {HTMLCanvasElement|null} canvas - The target canvas element.
 * @param {Object|null} latest - The most recent footprint result.
 * @param {Object} latest.breakdown - Category breakdown with transport, food, energy, shopping values.
 * @returns {void}
 */
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

/**
 * Draws a fallback line chart on canvas when Chart.js is not available.
 * Renders grid lines, a line/area plot of the last 8 footprint values,
 * data points, and month labels.
 * @param {HTMLCanvasElement|null} canvas - The target canvas element.
 * @param {Array<Object>} footprints - Sorted footprint records (newest first).
 * @returns {void}
 */
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

/**
 * Renders a doughnut breakdown chart using Chart.js, or falls back to a
 * canvas-drawn donut when Chart.js is not loaded.
 * @param {Object|undefined} latest - The most recent footprint result with a `breakdown` property.
 * @returns {void}
 */
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
  // Accessible data table for screen readers
  const chartLabels = ['Transport', 'Food', 'Energy', 'Shopping'];
  const chartValues = [
    latest.breakdown.transport || 0,
    latest.breakdown.food || 0,
    latest.breakdown.energy || 0,
    latest.breakdown.shopping || 0,
  ];
  canvas.parentElement?.querySelector('.sr-only')?.remove();
  canvas.parentElement?.append(
    buildChartDataTable('Carbon footprint breakdown', chartLabels, chartValues, 'kg CO\u2082')
  );
}

/**
 * Renders a line trend chart of recent footprint history using Chart.js,
 * or falls back to a canvas-drawn line chart when Chart.js is not loaded.
 * @param {Array<Object>} footprints - Sorted footprint records (newest first).
 * @returns {void}
 */
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
  // Accessible data table for trend chart
  const trendLabels = chronological.map((item) =>
    new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(item.date || item.createdAt)),
  );
  const trendValues = chronological.map((item) => item.totalKg);
  canvas.parentElement?.querySelector('.sr-only')?.remove();
  canvas.parentElement?.append(
    buildChartDataTable('Carbon footprint trend', trendLabels, trendValues, 'kg CO\u2082/year')
  );
}

export { drawFallbackDonut, drawFallbackLine, renderBreakdownChart, renderTrendChart };
