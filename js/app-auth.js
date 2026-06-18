/**
 * @module app-auth
 * @description Authentication UI wiring for EcoTrace. Handles Google sign-in,
 * email/password forms, sign-out, password-visibility toggles, forgot-password
 * flows, and synchronising DOM elements with the current auth state.
 */
import { appState, setButtonBusy, showToast } from "./app.js";
import { hasFirebaseConfig } from "./config.js";
import { ecoService, trackEvent } from "./firebase.js";
import { logError } from "./logger.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Minimum acceptable password length for email sign-up. */
const MIN_PASSWORD_LENGTH = 6;

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
        trackEvent('sign_in', { method: 'google' });
        showToast("Signed in with Google.");
        const returnTo = sessionStorage.getItem("ecotrace.returnTo");
        if (returnTo) {
          sessionStorage.removeItem("ecotrace.returnTo");
          window.location.href = returnTo;
        }
      } catch (error) {
        if (error?.code !== "auth/firebase-config-missing") logError('app', error);
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
        }
        showToast("Signed out safely.");
        if (document.body.matches("[data-auth-required]") && hasFirebaseConfig()) {
          window.location.href = "index.html";
        }
      } catch (error) {
        logError('app', error);
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
        trackEvent(action === 'signup' ? 'sign_up' : 'sign_in', { method: 'email' });
        showToast(action === "signup" ? "EcoTrace account created." : "Signed in successfully.");
        form.reset();
      } catch (error) {
        if (!isExpectedAuthError(error)) logError('app', error);
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
 * Synchronises all DOM elements bound via `data-auth-*` attributes with the
 * current user/profile data (display name, email, avatar, points).
 * @param {object|null} user    - Firebase Auth user object.
 * @param {object|null} profile - EcoTrace profile document.
 */
export function updateAuthUI(user, profile) {
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
 * Wires up all authentication-related DOM actions: Google sign-in buttons,
 * email/password forms, sign-out buttons, password-visibility toggles,
 * and "forgot password" links.
 */
export function initAuthActions() {
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
