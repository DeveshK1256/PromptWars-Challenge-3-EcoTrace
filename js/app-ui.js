/**
 * @module app-ui
 * @description UI helper functions extracted from the core app module.
 * Provides toast notifications, button busy-state management, empty-state
 * placeholders, responsive navigation, the live CO₂ counter, country-
 * emissions table rendering, footer-year insertion, and reduced-motion toggle.
 */
import { COUNTRY_EMISSIONS, COUNTRY_EMISSIONS_YEARS } from "./data.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Duration (ms) a toast notification stays visible before auto-removal. */
const TOAST_DURATION_MS = 4600;

/** Estimated global CO₂ emissions per year in metric tonnes. */
const YEARLY_GLOBAL_CO2_TONNES = 37_400_000_000;

/** Interval (ms) between carbon-counter UI refreshes. */
const COUNTER_INTERVAL_MS = 1000;

/** Desktop breakpoint (px) at which the mobile nav auto-closes. */
const DESKTOP_BREAKPOINT_PX = 1081;

/** Number of seconds in a standard (non-leap) year. */
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/* ── Toast / notification ───────────────────────────────────────── */

/**
 * Displays a brief toast notification to the user.
 * @param {string} message - Text to show inside the toast.
 * @param {"success"|"error"} [tone="success"] - Visual tone / colour of the toast.
 */
export function showToast(message, tone = "success") {
  let region = document.querySelector("[data-toast-region]");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("data-toast-region", "");
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const toast = document.createElement("p");
  toast.className = `toast toast-${tone}`;
  if (tone === "error") toast.setAttribute("role", "alert");
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

/* ── Button busy state ──────────────────────────────────────────── */

/**
 * Toggles a button into or out of a "busy" (loading) state.
 * While busy the button is disabled, shows a spinner-text, and sets `aria-busy`.
 * @param {HTMLButtonElement|null} button  - The button element to modify.
 * @param {boolean}                isBusy  - `true` to enter busy state, `false` to restore.
 * @param {string}                 [busyText="Working..."] - Label shown while busy.
 */
export function setButtonBusy(button, isBusy, busyText = "Working...") {
  if (!button) return;
  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

/* ── Empty-state placeholder ────────────────────────────────────── */

/**
 * Builds a stylised empty-state placeholder element.
 * @param {string} title              - Heading text.
 * @param {string} message            - Descriptive paragraph text.
 * @param {string} [icon="fa-seedling"] - Font Awesome icon class suffix.
 * @returns {HTMLDivElement} The assembled empty-state DOM node.
 */
export function buildEmptyState(title, message, icon = "fa-seedling") {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  const iconEl = document.createElement("i");
  iconEl.className = `fa-solid ${icon}`;
  iconEl.setAttribute("aria-hidden", "true");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = message;
  wrapper.append(iconEl, heading, text);
  return wrapper;
}

/* ── Navigation ─────────────────────────────────────────────────── */

/**
 * Extracts the filename portion of the current URL pathname.
 * @returns {string} The current page filename, e.g. "dashboard.html".
 */
function getPageName() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  return path;
}

/**
 * Sets the `aria-current="page"` attribute on the nav link matching the
 * current page, so CSS can highlight the active route.
 */
export function markActiveNav() {
  const page = getPageName().toLowerCase();
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href") || "index.html";
    const hrefPage = new URL(href, window.location.href).pathname
      .split("/").pop().toLowerCase() || "index.html";
    const active = hrefPage === page
      || (page === "" && hrefPage === "index.html");
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

/**
 * Sets up the mobile navigation menu behaviour: click-to-toggle, backdrop
 * dismiss, Escape-key close, link-click close, and auto-close on desktop resize.
 * @param {HTMLElement} toggle      - The hamburger / menu toggle button.
 * @param {HTMLElement} menu        - The navigation menu element.
 * @param {HTMLElement|null} nav    - The closest `.nav` ancestor for outside-click detection.
 * @param {HTMLElement|null} toggleLabel - The `.sr-only` label inside the toggle button.
 */
function setupMobileMenu(toggle, menu, nav, toggleLabel) {
  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  const setMenuOpen = (open, returnFocus = false) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    if (toggleLabel) toggleLabel.textContent = open ? "Close menu" : "Open menu";
    if (!open && returnFocus) toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener("click", () => {
    setMenuOpen(!isOpen());
  });

  menu.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a[href]")) setMenuOpen(false);
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (isOpen() && target && nav && !nav.contains(target)) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) setMenuOpen(false, true);
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches) setMenuOpen(false);
  });
}

/**
 * Initialises the responsive mobile navigation: toggle button, backdrop
 * dismiss, Escape-key close, and auto-close on desktop resize.
 */
export function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;
  const nav = toggle.closest(".nav") || menu.parentElement;
  const toggleLabel = toggle.querySelector(".sr-only");

  setupMobileMenu(toggle, menu, nav, toggleLabel);
}

/* ── Carbon counter ─────────────────────────────────────────────── */

/**
 * Starts the live global CO₂ counter on the homepage hero section,
 * estimating cumulative emissions since 1 January of the current year.
 */
export function initCarbonCounter() {
  const counter = document.querySelector("[data-co2-counter]");
  if (!counter) return;
  const tonnesPerSecond = YEARLY_GLOBAL_CO2_TONNES / SECONDS_PER_YEAR;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const render = () => {
    const seconds = Math.max(0, (Date.now() - yearStart) / 1000);
    const total = Math.floor(seconds * tonnesPerSecond);
    counter.textContent = total.toLocaleString("en-IN");
    if (!reducedMotion) window.setTimeout(render, COUNTER_INTERVAL_MS);
  };
  render();
}

/* ── Country emissions table ────────────────────────────────────── */

/**
 * Renders the interactive country-emissions table with year-tab switching
 * on the homepage Emissions section.
 */
export function initCountryEmissions() {
  const tabsContainer = document.querySelector("[data-year-tabs]");
  const tableContainer = document.querySelector("[data-country-table]");
  if (!tabsContainer || !tableContainer) return;

  let activeYear = COUNTRY_EMISSIONS_YEARS[COUNTRY_EMISSIONS_YEARS.length - 1];

  function renderTabs() {
    tabsContainer.replaceChildren();
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      const btn = document.createElement("button");
      btn.className = "filter-tab";
      btn.type = "button";
      btn.role = "tab";
      btn.textContent = year;
      btn.setAttribute("aria-pressed", String(year === activeYear));
      btn.setAttribute("aria-selected", String(year === activeYear));
      btn.addEventListener("click", () => {
        activeYear = year;
        renderTabs();
        renderTable();
      });
      tabsContainer.append(btn);
    });
  }

  /**
   * Creates the `<thead>` element for the country-emissions table.
   * @returns {HTMLTableSectionElement} The assembled table header.
   */
  function createTableHeader() {
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = [
      { text: "#", className: "ct-rank" },
      { text: "Country", className: "ct-country" },
      { text: "Emissions (MT)", className: "ct-emissions" },
      { text: "Relative Output", className: "ct-bar" },
      { text: "Share", className: "ct-pct" },
    ];
    headers.forEach(({ text, className }) => {
      const th = document.createElement("th");
      th.className = className;
      th.textContent = text;
      headerRow.append(th);
    });
    thead.append(headerRow);
    return thead;
  }

  /**
   * Creates a single `<tr>` element for one country-emissions entry.
   * @param {{ country: string, flag: string, emissions: number }} entry - The country data.
   * @param {number} index          - Zero-based position in the sorted list.
   * @param {number} totalEmissions - Sum of all countries' emissions for percentage calc.
   * @param {number} maxEmissions   - Highest single-country emission for bar-width calc.
   * @returns {HTMLTableRowElement} The assembled table row.
   */
  function createTableRow(entry, index, totalEmissions, maxEmissions) {
    const pct = ((entry.emissions / totalEmissions) * 100).toFixed(1);
    const barWidth = ((entry.emissions / maxEmissions) * 100).toFixed(1);
    const rankClass = index < 3 ? `ct-rank-top ct-rank-${index + 1}` : "";

    const tr = document.createElement("tr");
    tr.className = "ct-row";

    const rankCell = document.createElement("td");
    rankCell.className = "ct-rank-cell";
    const rankBadge = document.createElement("span");
    rankBadge.className = `ct-rank-badge ${rankClass}`;
    rankBadge.textContent = String(index + 1);
    rankCell.append(rankBadge);

    const countryCell = document.createElement("td");
    countryCell.className = "ct-country-cell";
    const flagSpan = document.createElement("span");
    flagSpan.className = "ct-flag";
    flagSpan.textContent = entry.flag;
    const nameSpan = document.createElement("span");
    nameSpan.className = "ct-name";
    nameSpan.textContent = entry.country;
    countryCell.append(flagSpan, nameSpan);

    const emissionsCell = document.createElement("td");
    emissionsCell.className = "ct-emissions-cell";
    emissionsCell.textContent = entry.emissions.toLocaleString();

    const barCell = document.createElement("td");
    barCell.className = "ct-bar-cell";
    const barTrack = document.createElement("div");
    barTrack.className = "ct-bar-track";
    const barFill = document.createElement("div");
    barFill.className = "ct-bar-fill";
    barFill.style.inlineSize = `${barWidth}%`;
    barTrack.append(barFill);
    barCell.append(barTrack);

    const pctCell = document.createElement("td");
    pctCell.className = "ct-pct-cell";
    pctCell.textContent = `${pct}%`;

    tr.append(rankCell, countryCell, emissionsCell, barCell, pctCell);
    return tr;
  }

  function renderTable() {
    const data = COUNTRY_EMISSIONS[activeYear];
    if (!data) return;
    const totalEmissions = data.reduce((sum, c) => sum + c.emissions, 0);
    const maxEmissions = data[0].emissions;

    const table = document.createElement("table");
    table.className = "country-table";
    table.setAttribute("role", "table");
    table.setAttribute(
      "aria-label",
      `CO₂ emissions by country in ${activeYear}`,
    );

    const thead = createTableHeader();
    const tbody = document.createElement("tbody");
    data.forEach((entry, index) => {
      tbody.append(createTableRow(entry, index, totalEmissions, maxEmissions));
    });

    table.append(thead, tbody);
    tableContainer.replaceChildren(table);
    tableContainer.setAttribute("aria-live", "polite");
    tableContainer.setAttribute(
      "aria-label",
      `Country emissions for ${activeYear}`,
    );
  }

  renderTabs();
  renderTable();
}

/* ── Footer year ────────────────────────────────────────────────── */

/**
 * Sets all `[data-current-year]` elements to the current four-digit year.
 */
export function initFooterYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

/* ── Reduced-motion toggle ──────────────────────────────────────── */

/**
 * Hooks up the reduced-motion toggle buttons, adding/removing the
 * `reduce-motion` class on `<html>` and announcing the change via toast.
 */
export function initReducedMotionToggle() {
  document.querySelectorAll("[data-reduced-motion]").forEach((button) => {
    button.addEventListener("click", () => {
      const enabled = document.documentElement.classList.toggle("reduce-motion");
      button.setAttribute("aria-pressed", String(enabled));
      showToast(enabled ? "Extra motion reduced." : "Motion restored.");
    });
  });
}
