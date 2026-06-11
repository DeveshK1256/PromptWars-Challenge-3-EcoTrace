/**
 * @module firebase-auth
 * @description EcoTrace Firebase authentication service. Handles user sign-in,
 * sign-up, sign-out, password reset, and account deletion — with seamless
 * local-storage fallback ("demo mode") when Firebase credentials are not
 * configured. Shared helpers (`initFirebase`, `serializeFirebaseUser`,
 * `ensureUserDocument`) are also exported for use by the data layer in
 * `firebase.js`.
 */
import { ECO_CONFIG, hasFirebaseConfig } from "./config.js";
import { logError } from "./logger.js";

import {
  normalizeEmail, createAuthError, hashDemoPassword,
  readDemoAccounts, writeDemoAccounts, getDemoProfile, saveDemoProfile,
  addActivity, createDemoAccountProfile,
  STORAGE_KEYS, DEFAULT_PROFILE, DEFAULT_DISPLAY_NAME,
} from "./demo-store.js";

/* ── Named constants ──────────────────────────────────────────────── */

/** @type {string} Error code used when Firebase config is missing. */
const AUTH_CONFIG_MISSING = "auth/firebase-config-missing";

/** @type {string} Error code for demo-mode-only operations. */
const AUTH_DEMO_MODE = "auth/demo-mode";

/* ── Firebase runtime state ────────────────────────────────────────── */

let firebasePromise;
let firebaseRuntime;

/* ── Shared helpers (also re-used by firebase.js data layer) ──────── */

/**
 * Converts a Firebase Auth `User` object into a plain serialisable object.
 * @param {Object|null} user - Firebase Auth user (or null).
 * @returns {Object|null} Serialised user or null.
 */
export function serializeFirebaseUser(user) {
  return user
    ? {
        uid: user.uid,
        displayName: user.displayName || DEFAULT_DISPLAY_NAME,
        email: user.email || "",
        photoURL: user.photoURL || "",
        isDemo: false,
      }
    : null;
}

/**
 * Lazily initialises the Firebase SDK (app, auth, firestore) and caches
 * the runtime. Returns `null` when Firebase is not configured.
 * @returns {Promise<Object|null>} The cached Firebase runtime or null.
 */
export async function initFirebase() {
  if (!hasFirebaseConfig()) return null;
  if (firebaseRuntime) return firebaseRuntime;
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"),
    ]).then(([appMod, authMod, dbMod]) => {
      const app = appMod.initializeApp(ECO_CONFIG.firebase);
      const auth = authMod.getAuth(app);
      const db = dbMod.getFirestore(app);
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      firebaseRuntime = { app, auth, db, provider, authMod, dbMod };
      return firebaseRuntime;
    });
  }
  return firebasePromise;
}

/**
 * Ensures a Firestore `users/{uid}` document and matching
 * `publicProfiles/{uid}` document exist for the given user.
 * @param {Object} user - Serialised user object with at least `uid`.
 * @returns {Promise<Object|null>} The Firestore document reference, or null.
 */
export async function ensureUserDocument(user) {
  const runtime = await initFirebase();
  if (!runtime || !user) return null;
  const { db, dbMod } = runtime;
  const userRef = dbMod.doc(db, "users", user.uid);
  const snap = await dbMod.getDoc(userRef);
  if (!snap.exists()) {
    await dbMod.setDoc(
      userRef,
      {
        displayName: user.displayName || DEFAULT_DISPLAY_NAME,
        email: user.email || "",
        photoURL: user.photoURL || "",
        greenPoints: 0,
        co2Saved: 0,
        challengesCompleted: 0,
        completedTips: [],
        acceptedChallenges: [],
        readArticles: [],
        badgesEarned: [],
        streak: 0,
        createdAt: dbMod.serverTimestamp(),
        updatedAt: dbMod.serverTimestamp(),
      },
      { merge: true },
    );
  }
  const publicRef = dbMod.doc(db, "publicProfiles", user.uid);
  const publicSnap = await dbMod.getDoc(publicRef);
  const privateScore = snap.exists() ? Number(snap.data().greenPoints || 0) : 0;
  await dbMod.setDoc(
    publicRef,
    publicSnap.exists()
      ? {
          displayName: user.displayName || publicSnap.data().displayName || DEFAULT_DISPLAY_NAME,
          photoURL: user.photoURL || publicSnap.data().photoURL || "",
          updatedAt: dbMod.serverTimestamp(),
        }
      : {
          displayName: user.displayName || DEFAULT_DISPLAY_NAME,
          photoURL: user.photoURL || "",
          greenPoints: privateScore,
          updatedAt: dbMod.serverTimestamp(),
        },
    { merge: true },
  );
  return userRef;
}

/* ── Auth-only helper ─────────────────────────────────────────────── */

/**
 * Deletes every document in a Firestore query snapshot.
 * @param {Object} dbMod - The Firestore module.
 * @param {Object} querySnapshot - The snapshot whose docs should be deleted.
 * @returns {Promise<void>}
 */
async function deleteQuerySnapshot(dbMod, querySnapshot) {
  await Promise.all(querySnapshot.docs.map((docSnap) => dbMod.deleteDoc(docSnap.ref)));
}

/* ── authService ──────────────────────────────────────────────────── */

export const authService = {
  /**
   * Checks whether Firebase is fully configured.
   * @returns {Promise<boolean>} `true` if Firebase credentials are present.
   */
  async isConfigured() {
    return hasFirebaseConfig();
  },

  /**
   * Subscribes to authentication state changes.
   * In demo mode the callback is invoked immediately with the demo profile.
   * @param {Function} callback - Called with the serialised user or demo profile.
   * @returns {Promise<Function>} Unsubscribe function.
   */
  async onAuthState(callback) {
    const runtime = await initFirebase();
    if (!runtime) {
      callback(getDemoProfile());
      return () => undefined;
    }
    return runtime.authMod.onAuthStateChanged(runtime.auth, async (user) => {
      if (user) await ensureUserDocument(serializeFirebaseUser(user));
      callback(serializeFirebaseUser(user));
    });
  },

  /**
   * Returns the currently authenticated user or the demo profile.
   * @returns {Promise<Object>} The current user profile.
   */
  async getCurrentUser() {
    const runtime = await initFirebase();
    if (!runtime) return getDemoProfile();
    return serializeFirebaseUser(runtime.auth.currentUser);
  },

  /**
   * Initiates Google sign-in via popup.
   * @returns {Promise<Object>} The signed-in user profile.
   * @throws {Error} If Firebase is not configured.
   */
  async signInWithGoogle() {
    const runtime = await initFirebase();
    if (!runtime) {
      throw createAuthError(
        AUTH_CONFIG_MISSING,
        "Google sign-in requires complete Firebase configuration.",
      );
    }
    const credential = await runtime.authMod.signInWithPopup(runtime.auth, runtime.provider);
    const user = serializeFirebaseUser(credential.user);
    await ensureUserDocument(user);
    return user;
  },

  /**
   * Signs in with email and password. Uses demo-mode local accounts
   * when Firebase is not configured.
   * @param {string} email - User email.
   * @param {string} password - User password.
   * @returns {Promise<Object>} The signed-in user profile.
   * @throws {Error} If credentials are invalid.
   */
  async signInWithEmail(email, password) {
    const runtime = await initFirebase();
    if (!runtime) {
      const accountKey = normalizeEmail(email);
      const account = readDemoAccounts()[accountKey];
      if (!account) {
        throw createAuthError("auth/user-not-found", "No account exists for this email. Use Create account first.");
      }
      const passwordHash = await hashDemoPassword(accountKey, password);
      if (passwordHash !== account.passwordHash) {
        throw createAuthError("auth/wrong-password", "Incorrect email or password.");
      }
      const profile = saveDemoProfile(account.profile || createDemoAccountProfile(account.email, account.displayName));
      addActivity("Signed in with demo email credentials.", "auth");
      return profile;
    }
    const credential = await runtime.authMod.signInWithEmailAndPassword(runtime.auth, email, password);
    const user = serializeFirebaseUser(credential.user);
    await ensureUserDocument(user);
    return user;
  },

  /**
   * Creates a new email/password account. Falls back to local demo-mode
   * storage when Firebase is unavailable.
   * @param {string} email - New account email.
   * @param {string} password - New account password.
   * @param {string} [displayName="EcoTracer"] - Initial display name.
   * @returns {Promise<Object>} The newly created user profile.
   * @throws {Error} If the email is already registered.
   */
  async createEmailAccount(email, password, displayName = DEFAULT_DISPLAY_NAME) {
    const runtime = await initFirebase();
    if (!runtime) {
      const accountKey = normalizeEmail(email);
      const accounts = readDemoAccounts();
      if (accounts[accountKey]) {
        throw createAuthError("auth/email-already-in-use", "An account already exists for this email. Use Sign in.");
      }
      const profileData = createDemoAccountProfile(accountKey, displayName);
      accounts[accountKey] = {
        email: accountKey,
        displayName: profileData.displayName,
        photoURL: "",
        passwordHash: await hashDemoPassword(accountKey, password),
        profile: profileData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeDemoAccounts(accounts);
      const profile = saveDemoProfile(profileData);
      addActivity("Created a demo EcoTrace account.", "auth");
      return profile;
    }
    const credential = await runtime.authMod.createUserWithEmailAndPassword(runtime.auth, email, password);
    await runtime.authMod.updateProfile(credential.user, { displayName });
    const user = serializeFirebaseUser(credential.user);
    await ensureUserDocument(user);
    return user;
  },

  /**
   * Signs the user out. In demo mode, resets the profile to defaults.
   * @returns {Promise<void>}
   */
  async signOut() {
    const runtime = await initFirebase();
    if (!runtime) {
      addActivity("Returned to demo guest mode.", "auth");
      saveDemoProfile(DEFAULT_PROFILE);
      return;
    }
    await runtime.authMod.signOut(runtime.auth);
  },

  /**
   * Sends a password-reset email via Firebase Auth.
   * Throws in demo mode since emails cannot be sent locally.
   * @param {string} email - The email to send the reset link to.
   * @returns {Promise<void>}
   * @throws {Error} In demo mode or on Firebase Auth errors.
   */
  async sendPasswordReset(email) {
    const runtime = await initFirebase();
    if (!runtime) {
      throw createAuthError(
        AUTH_DEMO_MODE,
        `You're in demo mode — accounts are stored locally in your browser. `
          + `Password reset emails cannot be sent. Try signing in with the password `
          + `you used to create the account, or create a new account.`,
      );
    }
    try {
      await runtime.authMod.sendPasswordResetEmail(runtime.auth, email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        throw createAuthError(
          "auth/user-not-found",
          `This email is not registered in Firebase. If you created your account `
            + `while offline or in demo mode, it only exists locally. `
            + `Please create a new account.`,
        );
      }
      if (err.code === "auth/invalid-email") {
        throw createAuthError("auth/invalid-email", "Please enter a valid email address.");
      }
      if (err.code === "auth/too-many-requests") {
        throw createAuthError("auth/too-many-requests", "Too many attempts. Please try again later.");
      }
      logError('firebase', "Password reset error:", err);
      throw err;
    }
  },

  /**
   * Permanently deletes a user account including all footprints,
   * activities, and public profile data.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @returns {Promise<void>}
   */
  async deleteAccount(user) {
    const runtime = await initFirebase();
    if (!runtime || !user || user.isDemo) {
      const accounts = readDemoAccounts();
      const accountKey = normalizeEmail(user?.email || getDemoProfile().email);
      if (accountKey && accounts[accountKey]) {
        delete accounts[accountKey];
        writeDemoAccounts(accounts);
      }
      localStorage.removeItem(STORAGE_KEYS.profile);
      localStorage.removeItem(STORAGE_KEYS.footprints);
      localStorage.removeItem(STORAGE_KEYS.activities);
      return;
    }
    const { db, dbMod } = runtime;
    const footprints = await dbMod.getDocs(dbMod.collection(db, "users", user.uid, "footprints"));
    const activities = await dbMod.getDocs(dbMod.collection(db, "users", user.uid, "activities"));
    await Promise.all([
      deleteQuerySnapshot(dbMod, footprints),
      deleteQuerySnapshot(dbMod, activities),
      dbMod.deleteDoc(dbMod.doc(db, "publicProfiles", user.uid)),
    ]);
    await dbMod.deleteDoc(dbMod.doc(db, "users", user.uid));
    if (runtime.auth.currentUser) await runtime.authMod.deleteUser(runtime.auth.currentUser);
  },
};
