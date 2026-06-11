import { hasFirebaseConfig, hasGeminiConfig, hasMapsConfig, hasSearchConfig } from "./config.js?v=firebase-config-26";
import { ecoService } from "./firebase.js?v=firebase-config-26";
import { BADGES, COUNTRY_EMISSIONS, COUNTRY_EMISSIONS_YEARS } from "./data.js?v=firebase-config-26";

export const appState = {
  user: null,
  profile: null,
  authReady: false,
};

const userReadyHandlers = new Set();

export function formatKg(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}T`;
  return `${Math.round(amount).toLocaleString()} kg`;
}

export function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getBadgeIds(points = 0) {
  return BADGES.filter((badge) => points >= badge.threshold).map((badge) => badge.id);
}

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
  window.setTimeout(() => toast.remove(), 4600);
}

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

export function onUserReady(handler) {
  userReadyHandlers.add(handler);
  if (appState.authReady) handler(appState.user, appState.profile);
  return () => userReadyHandlers.delete(handler);
}

function getPageName() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  return path;
}

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

function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;
  const nav = toggle.closest(".nav") || menu.parentElement;
  const toggleLabel = toggle.querySelector(".sr-only");

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
    if (window.matchMedia("(min-width: 1081px)").matches) setMenuOpen(false);
  });
}

function initCarbonCounter() {
  const counter = document.querySelector("[data-co2-counter]");
  if (!counter) return;
  const yearlyTonnes = 37_400_000_000;
  const tonnesPerSecond = yearlyTonnes / (365 * 24 * 60 * 60);
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const render = () => {
    const seconds = Math.max(0, (Date.now() - yearStart) / 1000);
    const total = Math.floor(seconds * tonnesPerSecond);
    counter.textContent = total.toLocaleString("en-IN");
    if (!reducedMotion) window.setTimeout(render, 1000);
  };
  render();
}

function initCountryEmissions() {
  const tabsContainer = document.querySelector("[data-year-tabs]");
  const tableContainer = document.querySelector("[data-country-table]");
  if (!tabsContainer || !tableContainer) return;

  let activeYear = COUNTRY_EMISSIONS_YEARS[COUNTRY_EMISSIONS_YEARS.length - 1];

  function renderTabs() {
    tabsContainer.innerHTML = "";
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

  function renderTable() {
    const data = COUNTRY_EMISSIONS[activeYear];
    if (!data) return;
    const totalEmissions = data.reduce((sum, c) => sum + c.emissions, 0);
    const maxEmissions = data[0].emissions;

    let html = `<table class="country-table" role="table" aria-label="CO₂ emissions by country in ${activeYear}">`;
    html += `<thead><tr>`;
    html += `<th class="ct-rank">#</th>`;
    html += `<th class="ct-country">Country</th>`;
    html += `<th class="ct-emissions">Emissions (MT)</th>`;
    html += `<th class="ct-bar">Relative Output</th>`;
    html += `<th class="ct-pct">Share</th>`;
    html += `</tr></thead><tbody>`;

    data.forEach((entry, index) => {
      const pct = ((entry.emissions / totalEmissions) * 100).toFixed(1);
      const barWidth = ((entry.emissions / maxEmissions) * 100).toFixed(1);
      const rankClass = index < 3 ? `ct-rank-top ct-rank-${index + 1}` : "";

      html += `<tr class="ct-row">`;
      html += `<td class="ct-rank-cell"><span class="ct-rank-badge ${rankClass}">${index + 1}</span></td>`;
      html += `<td class="ct-country-cell"><span class="ct-flag">${entry.flag}</span><span class="ct-name">${entry.country}</span></td>`;
      html += `<td class="ct-emissions-cell">${entry.emissions.toLocaleString()}</td>`;
      html += `<td class="ct-bar-cell"><div class="ct-bar-track"><div class="ct-bar-fill" style="inline-size:${barWidth}%"></div></div></td>`;
      html += `<td class="ct-pct-cell">${pct}%</td>`;
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
    tableContainer.setAttribute("aria-live", "polite");
    tableContainer.setAttribute("aria-label", `Country emissions for ${activeYear}`);
  }

  renderTabs();
  renderTable();
}

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

function enforceAuthGuard(user) {
  if (!document.body.matches("[data-auth-required]")) return;
  if (!hasFirebaseConfig()) return;
  if (user) return;
  sessionStorage.setItem("ecotrace.returnTo", window.location.pathname.split("/").pop() || "dashboard.html");
  window.location.href = "index.html?auth=required";
}

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

function initAuthActions() {
  const expectedAuthCodes = new Set(["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential", "auth/email-already-in-use"]);
  const isExpectedAuthError = (error) => expectedAuthCodes.has(error?.code);
  const getAuthErrorMessage = (error, action) => {
    const code = error?.code || "";
    if (code.includes("user-not-found")) return "No account exists for this email. Use Create account first.";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password.";
    if (code.includes("email-already-in-use")) return "An account already exists for this email. Use Sign in.";
    return action === "signup"
      ? `Signup failed: ${error?.code || "unknown"} — ${error?.message || "Please check your details."}`
      : `Sign-in failed: ${error?.code || "unknown"} — ${error?.message || "Check your details and try again."}`;
  };

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

  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter || form.querySelector("[type='submit']");
      const action = submitter?.value || submitter?.dataset.authAction || "signin";
      const data = new FormData(form);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      const displayName = String(data.get("displayName") || "").trim() || "EcoTracer";
      if (!email || password.length < 6) {
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

  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".password-wrapper");
      const input = wrapper?.querySelector("input");
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

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
        const isConfigured = await ecoService.isConfigured();
        await ecoService.sendPasswordReset(email);
        if (isConfigured) {
          showToast("Password reset email sent to " + email + ". Check your inbox.", "success");
        } else {
          showToast("Demo mode: Password reset is simulated. Connect Firebase for real email delivery.", "error");
        }
      } catch (error) {
        showToast(error.message || "Could not send reset email. Check the address.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Forgot password?";
      }
    });
  });
}

function initFooterYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

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
    import("./chatbot.js?v=firebase-config-26").then((m) => m.initEcoBot()).catch(() => {});
  }
  setTimeout(loadChatbot, 2000);
  document.addEventListener("click", loadChatbot, { once: true });
  document.addEventListener("keydown", loadChatbot, { once: true });

  // Register service worker for caching
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
});
