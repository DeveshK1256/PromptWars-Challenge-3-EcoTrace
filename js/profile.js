import { BADGES } from "./data.js?v=firebase-config-22";
import { appState, formatDate, formatKg, onUserReady, setButtonBusy, showToast } from "./app.js?v=firebase-config-22";
import { ecoService } from "./firebase.js?v=firebase-config-22";

const form = document.querySelector("[data-profile-form]");
const historyBody = document.querySelector("[data-history-table]");
const deleteDialog = document.querySelector("[data-delete-dialog]");

function avatarDataUrl(name) {
  const initial = encodeURIComponent(String(name || "E").trim().charAt(0).toUpperCase() || "E");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='60' fill='%232f7c64'/%3E%3Ctext x='50%25' y='56%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial,sans-serif' font-size='56' font-weight='700' fill='white'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function renderProfile(user, profile) {
  const displayName = profile?.displayName || user?.displayName || "Eco Guest";
  const email = profile?.email || user?.email || "demo@ecotrace.local";
  setText("[data-profile-name]", displayName);
  setText("[data-profile-email]", email);
  const photo = document.querySelector("[data-profile-photo]");
  if (photo instanceof HTMLImageElement) {
    if (profile?.photoURL || user?.photoURL) {
      photo.src = profile?.photoURL || user?.photoURL;
      photo.alt = `${displayName}'s profile photo`;
    } else {
      photo.src = avatarDataUrl(displayName);
      photo.alt = `${displayName}'s initials avatar`;
    }
  }
  form?.elements.displayName && (form.elements.displayName.value = displayName);
  form?.elements.photoURL && (form.elements.photoURL.value = profile?.photoURL || user?.photoURL || "");
}

function renderStats(profile) {
  const points = Number(profile?.greenPoints || 0);
  const earnedBadges = BADGES.filter((badge) => points >= badge.threshold).length;
  setText("[data-stat-saved]", formatKg(profile?.co2Saved || 0));
  setText("[data-stat-challenges]", Number(profile?.challengesCompleted || 0).toLocaleString());
  setText("[data-stat-badges]", earnedBadges.toLocaleString());
  setText("[data-stat-points]", points.toLocaleString());
}

function renderHistory(records) {
  if (!historyBody) return;
  historyBody.replaceChildren();
  const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.slice(0, 12).forEach((record, index) => {
    const previous = sorted[index + 1];
    const change = previous ? ((record.totalKg - previous.totalKg) / previous.totalKg) * 100 : 0;
    const row = document.createElement("tr");
    const date = document.createElement("td");
    date.textContent = formatDate(record.date);
    const score = document.createElement("td");
    score.textContent = `${Math.round(record.totalKg).toLocaleString()} kg`;
    const delta = document.createElement("td");
    delta.className = change <= 0 ? "positive-change" : "negative-change";
    delta.textContent = previous ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "Baseline";
    row.append(date, score, delta);
    historyBody.append(row);
  });
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter || form.querySelector("[type='submit']");
  const data = new FormData(form);
  setButtonBusy(button, true, "Saving...");
  try {
    const updates = {
      displayName: data.get("displayName"),
      photoURL: data.get("photoURL"),
    };
    appState.profile = await ecoService.updateUserProfile(appState.user, updates);
    renderProfile(appState.user, appState.profile);
    showToast("Profile updated.");
  } catch (error) {
    console.error(error);
    showToast("Profile could not be updated.", "error");
  } finally {
    setButtonBusy(button, false);
  }
});

const deleteTrigger = document.querySelector("[data-open-delete]");
deleteTrigger?.addEventListener("click", () => {
  if (deleteDialog?.showModal) {
    deleteDialog.showModal();
    const firstFocusable = deleteDialog.querySelector("button, input, [tabindex]");
    if (firstFocusable) firstFocusable.focus();
  }
});

document.querySelector("[data-close-delete]")?.addEventListener("click", () => {
  deleteDialog?.close();
  deleteTrigger?.focus();
});

/* Focus trap: keep Tab cycling within the dialog */
deleteDialog?.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focusables = [...deleteDialog.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')];
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

document.querySelector("[data-confirm-delete]")?.addEventListener("click", async (event) => {
  const confirmation = document.querySelector("[data-delete-confirmation]")?.value;
  if (confirmation !== "DELETE") {
    showToast("Type DELETE to confirm account deletion.", "error");
    return;
  }
  const button = event.currentTarget;
  setButtonBusy(button, true, "Deleting...");
  try {
    await ecoService.deleteAccount(appState.user);
    showToast("Account data deleted.");
    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
    showToast("Account could not be deleted. Recent sign-in may be required.", "error");
  } finally {
    setButtonBusy(button, false);
  }
});

onUserReady(async (user, profile) => {
  renderProfile(user, profile);
  renderStats(profile);
  const history = await ecoService.getFootprints(user);
  renderHistory(history);
});
