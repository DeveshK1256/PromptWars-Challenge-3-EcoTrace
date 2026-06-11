/**
 * @module app
 * @description Core application bootstrap for EcoTrace. Provides shared state,
 * utility helpers (formatting, toasts, UI), auth flow, navigation, a live
 * global CO₂ counter, and country-emissions table rendering.
 */
import { hasFirebaseConfig } from "./config.js";
import { ecoService } from "./firebase.js";
import { BADGES, COUNTRY_EMISSIONS, COUNTRY_EMISSIONS_YEARS } from "./data.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Kilograms in one metric tonne. */
const KG_PER_TONNE = 1000;

/** Threshold (in kg) above which tonnes are shown with 0 decimal places. */
const LARGE_TONNE_THRESHOLD = 10000;

/** Duration (ms) a toast notification stays visible before auto-removal. */
const TOAST_DURATION_MS = 4600;

/** Minimum acceptable password length for email sign-up. */
const MIN_PASSWORD_LENGTH = 6;

/** Estimated global CO₂ emissions per year in metric tonnes. */
const YEARLY_GLOBAL_CO2_TONNES = 37_400_000_000;

/** Interval (ms) between carbon-counter UI refreshes. */
const COUNTER_INTERVAL_MS = 1000;

/** Desktop breakpoint (px) at which the mobile nav auto-closes. */
const DESKTOP_BREAKPOINT_PX = 1081;

/** Delay (ms) before lazily loading the chatbot module. */
const CHATBOT_LAZY_DELAY_MS = 2000;

/** Number of seconds in a standard (non-leap) year. */
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Shared application state holding the current user, profile, and auth readiness.
 * @type {{ user: object|null, profile: object|null, authReady: boolean }}
 */
export const appState = {
  user: null,
  profile: null,
  authReady: false,
};

const userReadyHandlers = new Set();

/**
 * Formats a kilogram value for display, converting to tonnes when ≥ 1 000 kg.
 * @param {number} value - The kilogram value to format.
 * @returns {string} Formatted string like "1,234 kg" or "1.2T".
 */
export function formatKg(value) {
  const amount = Number(value) || 0;
  if (amount >= KG_PER_TONNE) {
    return `${(amount / KG_PER_TONNE).toFixed(amount >= LARGE_TONNE_THRESHOLD ? 0 : 1)}T`;
  }
  return `${Math.round(amount).toLocaleString()} kg`;
}

/**
 * Formats a date value into a human-readable "dd MMM yyyy" string (en-IN locale).
 * @param {string|number|Date|null} value - A value parseable by `new Date()`.
 * @returns {string} Formatted date string, or "Not recorded" if falsy.
 */
export function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Clamps a numeric value between a minimum and maximum (inclusive).
 * @param {number} value - The value to clamp.
 * @param {number} min   - Lower bound.
 * @param {number} max   - Upper bound.
 * @returns {number} The clamped value.
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns the IDs of all badges the user has earned at the given point total.
 * @param {number} [points=0] - The user's current green-point total.
 * @returns {string[]} Array of earned badge IDs.
 */
export function getBadgeIds(points = 0) {
  return BADGES.filter((badge) => points >= badge.threshold).map((badge) => badge.id);
}

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
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

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

/**
 * Registers a callback to run once authentication state is resolved.
 * If auth is already ready, the handler fires immediately.
 * @param {(user: object|null, profile: object|null) => void} handler - Callback receiving user & profile.
 * @returns {() => boolean} Unsubscribe function that removes the handler.
 */
export function onUserReady(handler) {
  userReadyHandlers.add(handler);
  if (appState.authReady) handler(appState.user, appState.profile);
  return () => userReadyHandlers.delete(handler);
}

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
function markActiveNav() {
  const page = getPageName().toLowerCase();
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href") || "index.html";
    const hrefPage = new URL(href, window.location.href).pathname.split("/").pop().toLowerCase() || "index.html";
    const active = hrefPage === page || (page === "" && hrefPage === "index.html");
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
function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;
  const nav = toggle.closest(".nav") || menu.parentElement;
  const toggleLabel = toggle.querySelector(".sr-only");

  setupMobileMenu(toggle, menu, nav, toggleLabel);
}

/**
 * Starts the live global CO₂ counter on the homepage hero section,
 * estimating cumulative emissions since 1 January of the current year.
 */
function initCarbonCounter() {
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

/**
 * Renders the interactive country-emissions table with year-tab switching
 * on the homepage Emissions section.
 */
function initCountryEmissions() {
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
    table.setAttribute("aria-label", `CO₂ emissions by country in ${activeYear}`);

    const thead = createTableHeader();
    const tbody = document.createElement("tbody");
    data.forEach((entry, index) => {
      tbody.append(createTableRow(entry, index, totalEmissions, maxEmissions));
    });

    table.append(thead, tbody);
    tableContainer.replaceChildren(table);
    tableContainer.setAttribute("aria-live", "polite");
    tableContainer.setAttribute("aria-label", `Country emissions for ${activeYear}`);
  }

  renderTabs();
  renderTable();
}

/**
 * Synchronises all DOM elements bound via `data-auth-*` attributes with the
 * current user/profile data (display name, email, avatar, points).
 * @param {object|null} user    - Firebase Auth user object.
 * @param {object|null} profile - EcoTrace profile document.
 */
function updateAuthUI(user, profile) {
  const displayName = profile?.displayName || user?.displayName || "";
  const email = profile?.email || user?.email || "";
  document.querySelectorAll("[data-auth-name]").forEach((node) => {
    node.textContent = displayName;
  });
  document.querySelectorAll("[data-auth-email]").forEach((node) => {
    node.textContent = email;
  });
  document.querySelectorAll("[data-auth-avatar]").forEach((node) => {
    const photo = profile?.photoURL || user?.photoURL;
    if (photo && node instanceof HTMLImageElement) {
      node.src = photo;
      node.alt = `${displayName}'s profile photo`;
    } else {
      node.removeAttribute("src");
      node.alt = "";
    }
  });
  document.querySelectorAll("[data-points-wallet]").forEach((node) => {
    node.textContent = `${Number(profile?.greenPoints || 0).toLocaleString()} Green Points`;
  });
  document.documentElement.dataset.auth = user ? "signed-in" : "signed-out";
}

/**
 * Redirects unauthenticated visitors away from pages marked
 * with `data-auth-required`, saving the intended destination for
 * post-login redirect.
 * @param {object|null} user - The current Firebase Auth user (or null).
 */
function enforceAuthGuard(user) {
  if (!document.body.matches("[data-auth-required]")) return;
  if (!hasFirebaseConfig()) return;
  if (user) return;
  sessionStorage.setItem(
    "ecotrace.returnTo",
    window.location.pathname.split("/").pop() || "dashboard.html",
  );
  window.location.href = "index.html?auth=required";
}

/**
 * Subscribes to Firebase Auth state changes. On each change it refreshes
 * `appState`, updates the UI, enforces auth-guards, and notifies all
 * registered `onUserReady` handlers.
 */
async function initAuth() {
  await ecoService.onAuthState(async (user) => {
    appState.user = user;
    appState.profile = user ? await ecoService.getProfile(user) : null;
    appState.authReady = true;
    updateAuthUI(appState.user, appState.profile);
    enforceAuthGuard(appState.user);
    userReadyHandlers.forEach((handler) => handler(appState.user, appState.profile));
  });
}

/**
 * Attaches click handlers to all `[data-google-signin]` buttons to initiate
 * Google sign-in, update app state, and redirect if a return-to URL is saved.
 */
function setupGoogleSignIn() {
  document.querySelectorAll("[data-google-signin]").forEach((button) => {
    button.addEventListener("click", async () => {
      setButtonBusy(button, true, "Opening Google...");
      try {
        const user = await ecoService.signInWithGoogle();
        appState.user = user;
        appState.profile = await ecoService.getProfile(user);
        updateAuthUI(appState.user, appState.profile);
        showToast("Signed in with Google.");
        const returnTo = sessionStorage.getItem("ecotrace.returnTo");
        if (returnTo) {
          sessionStorage.removeItem("ecotrace.returnTo");
          window.location.href = returnTo;
        }
      } catch (error) {
        if (error?.code !== "auth/firebase-config-missing") console.error(error);
        showToast(
          error?.code === "auth/firebase-config-missing"
            ? "Google sign-in needs full Firebase setup. Email accounts still work."
            : `Google sign-in failed: ${error?.code || "unknown"} — ${error?.message || "Please try again."}`,
          "error",
        );
      } finally {
        setButtonBusy(button, false);
      }
    });
  });
}

/**
 * Attaches click handlers to all `[data-signout]` buttons to sign the user
 * out, refresh app state, and redirect away from protected pages.
 */
function setupSignOut() {
  document.querySelectorAll("[data-signout]").forEach((button) => {
    button.addEventListener("click", async () => {
      setButtonBusy(button, true, "Signing out...");
      try {
        await ecoService.signOut();
        if (!hasFirebaseConfig()) {
          appState.user = await ecoService.getCurrentUser();
          appState.profile = await ecoService.getProfile(appState.user);
          updateAuthUI(appState.user, appState.profile);
          userReadyHandlers.forEach((handler) => handler(appState.user, appState.profile));
        }
        showToast("Signed out safely.");
        if (document.body.matches("[data-auth-required]") && hasFirebaseConfig()) {
          window.location.href = "index.html";
        }
      } catch (error) {
        console.error(error);
        showToast("Sign out failed. Please try again.", "error");
      } finally {
        setButtonBusy(button, false);
      }
    });
  });
}

/**
 * Attaches submit handlers to all `[data-auth-form]` forms to handle both
 * sign-in and sign-up via email/password, with validation and error reporting.
 * @param {(error: object) => boolean} isExpectedAuthError - Predicate for expected auth errors.
 * @param {(error: object, action: string) => string} getAuthErrorMessage - Maps errors to user messages.
 */
function setupSignInForm(isExpectedAuthError, getAuthErrorMessage) {
  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter || form.querySelector("[type='submit']");
      const action = submitter?.value || submitter?.dataset.authAction || "signin";
      const data = new FormData(form);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      const displayName = String(data.get("displayName") || "").trim() || "EcoTracer";
      if (!email || password.length < MIN_PASSWORD_LENGTH) {
        showToast("Use a valid email and a password with at least 6 characters.", "error");
        return;
      }
      setButtonBusy(submitter, true, action === "signup" ? "Creating..." : "Signing in...");
      try {
        const user =
          action === "signup"
            ? await ecoService.createEmailAccount(email, password, displayName)
            : await ecoService.signInWithEmail(email, password);
        appState.user = user;
        appState.profile = await ecoService.getProfile(user);
        updateAuthUI(appState.user, appState.profile);
        showToast(action === "signup" ? "EcoTrace account created." : "Signed in successfully.");
        form.reset();
      } catch (error) {
        if (!isExpectedAuthError(error)) console.error(error);
        showToast(getAuthErrorMessage(error, action), "error");
      } finally {
        setButtonBusy(submitter, false);
      }
    });
  });
}

/**
 * Attaches click handlers to all `[data-toggle-password]` buttons to toggle
 * password field visibility between plain-text and masked modes.
 */
function setupPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".password-wrapper");
      const input = wrapper?.querySelector("input");
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.replaceChildren();
      const icon = document.createElement('i');
      icon.className = `fa-solid fa-eye${isPassword ? '' : '-slash'}`;
      icon.setAttribute('aria-hidden', 'true');
      btn.append(icon);
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });
}

/**
 * Attaches click handlers to all `[data-forgot-password]` buttons to send
 * a password-reset email to the address currently entered in the auth form.
 */
function setupForgotPassword() {
  document.querySelectorAll("[data-forgot-password]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const form = btn.closest("[data-auth-form]") || document.querySelector("[data-auth-form]");
      const email = form ? String(new FormData(form).get("email") || "").trim() : "";
      if (!email) {
        showToast("Enter your email address first, then click Forgot password.", "error");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Sending...";
      try {
        await ecoService.sendPasswordReset(email);
        showToast(`Password reset email sent to ${  email  }! Check your inbox and spam folder.`, "success");
      } catch (error) {
        showToast(error.message || "Could not send reset email.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Forgot password?";
      }
    });
  });
}

/**
 * Wires up all authentication-related DOM actions: Google sign-in buttons,
 * email/password forms, sign-out buttons, password-visibility toggles,
 * and "forgot password" links.
 */
function initAuthActions() {
  const expectedAuthCodes = new Set([
    "auth/user-not-found",
    "auth/wrong-password",
    "auth/invalid-credential",
    "auth/email-already-in-use",
  ]);

  /**
   * Checks whether an auth error is one we have a user-friendly message for.
   * @param {object} error - The Firebase Auth error.
   * @returns {boolean} `true` if the error code is in the expected set.
   */
  const isExpectedAuthError = (error) => expectedAuthCodes.has(error?.code);

  /**
   * Maps a Firebase Auth error to a human-readable toast message.
   * @param {object} error         - The Firebase Auth error.
   * @param {"signin"|"signup"} action - Which action triggered the error.
   * @returns {string} A user-friendly error message.
   */
  const getAuthErrorMessage = (error, action) => {
    const code = error?.code || "";
    if (code.includes("user-not-found")) return "No account exists for this email. Use Create account first.";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password.";
    if (code.includes("email-already-in-use")) return "An account already exists for this email. Use Sign in.";
    return action === "signup"
      ? `Signup failed: ${error?.code || "unknown"} — ${error?.message || "Please check your details."}`
      : `Sign-in failed: ${error?.code || "unknown"} — ${error?.message || "Check your details and try again."}`;
  };

  setupGoogleSignIn();
  setupSignOut();
  setupSignInForm(isExpectedAuthError, getAuthErrorMessage);
  setupPasswordToggles();
  setupForgotPassword();
}

/**
 * Sets all `[data-current-year]` elements to the current four-digit year.
 */
function initFooterYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

/**
 * Hooks up the reduced-motion toggle buttons, adding/removing the
 * `reduce-motion` class on `<html>` and announcing the change via toast.
 */
function initReducedMotionToggle() {
  document.querySelectorAll("[data-reduced-motion]").forEach((button) => {
    button.addEventListener("click", () => {
      const enabled = document.documentElement.classList.toggle("reduce-motion");
      button.setAttribute("aria-pressed", String(enabled));
      showToast(enabled ? "Extra motion reduced." : "Motion restored.");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  initNavigation();
  initCarbonCounter();
  initCountryEmissions();

  initAuthActions();
  initFooterYear();
  initReducedMotionToggle();
  initAuth();

  // Lazy-load chatbot after initial render to avoid blocking page load
  let chatbotLoaded = false;
  function loadChatbot() {
    if (chatbotLoaded) return;
    chatbotLoaded = true;
    import("./chatbot.js").then((m) => m.initEcoBot()).catch(() => {});
  }
  setTimeout(loadChatbot, CHATBOT_LAZY_DELAY_MS);
  document.addEventListener("click", loadChatbot, { once: true });
  document.addEventListener("keydown", loadChatbot, { once: true });

  // Register service worker for caching
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
