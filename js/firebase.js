/**
 * @module firebase
 * @description EcoTrace Firebase service layer. Provides authentication,
 * Firestore profile management, footprint tracking, green-points scoring,
 * and a leaderboard — with seamless local-storage fallback ("demo mode")
 * when Firebase credentials are not configured.
 */
import { ECO_CONFIG, hasFirebaseConfig } from "./config.js";
import { logError, logInfo, logWarn } from "./logger.js";

import {
  normalizeEmail, createAuthError, hashDemoPassword,
  readDemoAccounts, writeDemoAccounts,
  readJson, writeJson,
  getDemoProfile, saveDemoProfile,
  addActivity, createDemoAccountProfile,
  getLocalFootprints, STORAGE_KEYS,
  DEFAULT_PROFILE, DEFAULT_DISPLAY_NAME, MAX_FOOTPRINT_RECORDS,
} from "./demo-store.js";

/* ── Named constants ──────────────────────────────────────────────── */

/** @type {string} Error code used when Firebase config is missing. */
const AUTH_CONFIG_MISSING = "auth/firebase-config-missing";

/** @type {string} Error code for demo-mode-only operations. */
const AUTH_DEMO_MODE = "auth/demo-mode";

/** Maximum length for a user display name. */
const MAX_DISPLAY_NAME_LENGTH = 80;

/** Maximum length for a user photo URL. */
const MAX_PHOTO_URL_LENGTH = 400;

/** Number of leaderboard entries to fetch. */
const LEADERBOARD_LIMIT = 10;

/** Maximum number of activities returned from Firestore. */
const ACTIVITY_QUERY_LIMIT = 12;

/** Points awarded for completing a tip. */
const TIP_COMPLETION_POINTS = 10;

/** Points awarded for reading an article. */
const ARTICLE_READ_POINTS = 5;

/* ── Firebase runtime state ────────────────────────────────────────── */

let firebasePromise;
let firebaseRuntime;

/* ── Shared helpers ───────────────────────────────────────────────── */

/**
 * Converts a Firebase Auth `User` object into a plain serialisable object.
 * @param {Object|null} user - Firebase Auth user (or null).
 * @returns {Object|null} Serialised user or null.
 */
function serializeFirebaseUser(user) {
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
async function initFirebase() {
  if (!hasFirebaseConfig()) return null;
  if (firebaseRuntime) return firebaseRuntime;
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"),
    ]).then(async ([appMod, authMod, dbMod]) => {
      const app = appMod.initializeApp(ECO_CONFIG.firebase);
      const auth = authMod.getAuth(app);
      const db = dbMod.getFirestore(app);
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      firebaseRuntime = { app, auth, db, provider, authMod, dbMod };

      // Enable Firebase App Check with reCAPTCHA Enterprise
      try {
        const appCheckMod = await import(
          'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-check.js'
        );
        const recaptchaKey = ECO_CONFIG.firebase.recaptchaSiteKey || '';
        if (recaptchaKey && !recaptchaKey.startsWith('__')) {
          appCheckMod.initializeAppCheck(app, {
            provider: new appCheckMod.ReCaptchaEnterpriseProvider(recaptchaKey),
            isTokenAutoRefreshEnabled: true,
          });
          logInfo('firebase', 'App Check initialised');
        }
      } catch (appCheckError) {
        logWarn('firebase', 'App Check unavailable', appCheckError);
      }

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
async function ensureUserDocument(user) {
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

/* ── Profile helper ───────────────────────────────────────────────── */

/**
 * Fetches the full user profile from Firestore, falling back to demo
 * profile when Firebase is unavailable.
 * @param {Object} user - Serialised user object.
 * @returns {Promise<Object>} Merged profile data.
 */
async function getRemoteProfile(user) {
  try {
    const runtime = await initFirebase();
    if (!runtime || !user) return getDemoProfile();
    const { db, dbMod } = runtime;
    await ensureUserDocument(user);
    const snap = await dbMod.getDoc(dbMod.doc(db, "users", user.uid));
    return {
      ...serializeFirebaseUser(user),
      ...(snap.exists() ? snap.data() : {}),
    };
  } catch {
    return getDemoProfile();
  }
}

export const ecoService = {
  /* ── Auth methods ──────────────────────────────────────────────── */

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

  /* ── Data / profile methods ────────────────────────────────────── */

  /**
   * Retrieves the full profile for a user (Firestore or demo).
   * @param {Object|null} user - Serialised user, or null/demo.
   * @returns {Promise<Object>} The user profile.
   */
  async getProfile(user) {
    if (!user || user.isDemo) return getDemoProfile();
    return getRemoteProfile(user);
  },

  /**
   * Updates display name and photo URL for the given user.
   * Applies length limits and persists to Firestore or demo storage.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {Object} updates - Object with `displayName` and/or `photoURL`.
   * @returns {Promise<Object>} The updated profile.
   */
  async updateUserProfile(user, updates) {
    const cleanUpdates = {
      displayName: String(updates.displayName || "").trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
      photoURL: String(updates.photoURL || "").trim().slice(0, MAX_PHOTO_URL_LENGTH),
    };
    if (!user || user.isDemo) {
      const profile = saveDemoProfile(cleanUpdates);
      addActivity("Updated profile details.", "profile");
      return profile;
    }
    const runtime = await initFirebase();
    if (!runtime) return saveDemoProfile(cleanUpdates);
    if (runtime.auth.currentUser) {
      await runtime.authMod.updateProfile(runtime.auth.currentUser, cleanUpdates);
    }
    await runtime.dbMod.setDoc(
      runtime.dbMod.doc(runtime.db, "users", user.uid),
      { ...cleanUpdates, updatedAt: runtime.dbMod.serverTimestamp() },
      { merge: true },
    );
    await runtime.dbMod.setDoc(
      runtime.dbMod.doc(runtime.db, "publicProfiles", user.uid),
      {
        displayName: cleanUpdates.displayName,
        photoURL: cleanUpdates.photoURL,
        updatedAt: runtime.dbMod.serverTimestamp(),
      },
      { merge: true },
    );
    return { ...user, ...cleanUpdates };
  },

  /**
   * Saves a carbon-footprint calculation result for the user.
   * In demo mode the record is persisted to localStorage.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {Object} result - Footprint result with `totalKg` and `breakdown`.
   * @returns {Promise<Object>} The saved footprint record (with `id`).
   */
  async saveFootprint(user, result) {
    const record = {
      ...result,
      totalKg: Math.round(result.totalKg),
      date: new Date().toISOString(),
    };
    if (!user || user.isDemo) {
      const footprints = getLocalFootprints();
      const saved = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ...record,
      };
      writeJson(STORAGE_KEYS.footprints, [saved, ...footprints].slice(0, MAX_FOOTPRINT_RECORDS));
      const previous = footprints[0]?.totalKg || saved.totalKg;
      const savedKg = Math.max(0, previous - saved.totalKg);
      const profile = getDemoProfile();
      saveDemoProfile({ co2Saved: Math.round((profile.co2Saved || 0) + savedKg) });
      addActivity(`Saved a footprint score of ${saved.totalKg.toLocaleString()} kg CO₂/year.`, "footprint");
      return saved;
    }
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const footprintRef = await dbMod.addDoc(dbMod.collection(db, "users", user.uid, "footprints"), {
      ...record,
      createdAt: dbMod.serverTimestamp(),
    });
    await dbMod.setDoc(
      dbMod.doc(db, "users", user.uid),
      {
        latestFootprint: record,
        updatedAt: dbMod.serverTimestamp(),
      },
      { merge: true },
    );
    await dbMod.addDoc(dbMod.collection(db, "users", user.uid, "activities"), {
      message: `Saved a footprint score of ${record.totalKg.toLocaleString()} kg CO₂/year.`,
      type: "footprint",
      createdAt: dbMod.serverTimestamp(),
    });
    return { id: footprintRef.id, ...record };
  },

  /**
   * Retrieves up to {@link MAX_FOOTPRINT_RECORDS} footprint records for the user.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @returns {Promise<Array<Object>>} Array of footprint records, newest first.
   */
  async getFootprints(user) {
    if (!user || user.isDemo) return getLocalFootprints();
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const footprintsQuery = dbMod.query(
      dbMod.collection(db, "users", user.uid, "footprints"),
      dbMod.orderBy("createdAt", "desc"),
      dbMod.limit(MAX_FOOTPRINT_RECORDS),
    );
    const snap = await dbMod.getDocs(footprintsQuery);
    const records = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        date: data.date || data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString(),
      };
    });
    return records.length ? records : getLocalFootprints();
  },

  /**
   * Retrieves recent activity entries for the user.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @returns {Promise<Array<Object>>} Array of activity objects, newest first.
   */
  async getActivities(user) {
    if (!user || user.isDemo) return readJson(STORAGE_KEYS.activities, []);
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const activityQuery = dbMod.query(
      dbMod.collection(db, "users", user.uid, "activities"),
      dbMod.orderBy("createdAt", "desc"),
      dbMod.limit(ACTIVITY_QUERY_LIMIT),
    );
    const snap = await dbMod.getDocs(activityQuery);
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString(),
      };
    });
  },

  /**
   * Awards green points to a user, optionally guarded by a unique
   * field/id pair to prevent duplicate awards.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {number} points - Number of points to add (may be negative).
   * @param {string} [message] - Activity log message.
   * @param {string} [uniqueField] - Profile array field for dedup (e.g. "completedTips").
   * @param {string} [uniqueId] - Unique identifier within that field.
   * @returns {Promise<{awarded: boolean, profile: Object}>}
   */
  async addGreenPoints(user, points, message, uniqueField, uniqueId) {
    const amount = Number(points) || 0;
    if (!user || user.isDemo) {
      const profile = getDemoProfile();
      if (uniqueField && uniqueId && profile[uniqueField]?.includes(uniqueId)) {
        return { awarded: false, profile };
      }
      const nextList = uniqueField && uniqueId ? [...(profile[uniqueField] || []), uniqueId] : profile[uniqueField];
      const updated = saveDemoProfile({
        greenPoints: Math.max(0, (profile.greenPoints || 0) + amount),
        [uniqueField]: nextList,
      });
      addActivity(message || `Earned ${amount} Green Points.`, "points");
      return { awarded: true, profile: updated };
    }
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const userRef = dbMod.doc(db, "users", user.uid);
    const snap = await dbMod.getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    if (uniqueField && uniqueId && data[uniqueField]?.includes(uniqueId)) {
      return { awarded: false, profile: { ...user, ...data } };
    }
    const update = {
      greenPoints: dbMod.increment(amount),
      updatedAt: dbMod.serverTimestamp(),
    };
    if (uniqueField && uniqueId) update[uniqueField] = dbMod.arrayUnion(uniqueId);
    await dbMod.setDoc(userRef, update, { merge: true });
    if (message) {
      await dbMod.addDoc(dbMod.collection(db, "users", user.uid, "activities"), {
        message,
        type: "points",
        createdAt: dbMod.serverTimestamp(),
      });
    }
    const nextSnap = await dbMod.getDoc(userRef);
    const nextProfile = { ...user, ...(nextSnap.exists() ? nextSnap.data() : {}) };
    await dbMod.setDoc(
      dbMod.doc(db, "publicProfiles", user.uid),
      {
        displayName: nextProfile.displayName || user.displayName || DEFAULT_DISPLAY_NAME,
        photoURL: nextProfile.photoURL || user.photoURL || "",
        greenPoints: Number(nextProfile.greenPoints || 0),
        updatedAt: dbMod.serverTimestamp(),
      },
      { merge: true },
    );
    return { awarded: true, profile: nextProfile };
  },

  /**
   * Accepts a challenge for the user, awards its points, and increments
   * the `challengesCompleted` counter.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {Object} challenge - Challenge object with `id`, `title`, `points`.
   * @returns {Promise<{awarded: boolean, profile: Object}>}
   */
  async acceptChallenge(user, challenge) {
    const result = await this.addGreenPoints(
      user,
      challenge.points,
      `Accepted challenge: ${challenge.title} (+${challenge.points} points).`,
      "acceptedChallenges",
      challenge.id,
    );
    if (result.awarded) {
      if (!user || user.isDemo) {
        const profile = getDemoProfile();
        saveDemoProfile({ challengesCompleted: (profile.challengesCompleted || 0) + 1 });
      } else {
        const runtime = await initFirebase();
        await runtime.dbMod.setDoc(
          runtime.dbMod.doc(runtime.db, "users", user.uid),
          { challengesCompleted: runtime.dbMod.increment(1) },
          { merge: true },
        );
      }
    }
    return result;
  },

  /**
   * Marks a tip as completed and awards {@link TIP_COMPLETION_POINTS} points.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {Object} tip - Tip object with `id` and `title`.
   * @returns {Promise<{awarded: boolean, profile: Object}>}
   */
  async completeTip(user, tip) {
    return this.addGreenPoints(
      user,
      TIP_COMPLETION_POINTS,
      `Completed tip: ${tip.title} (+${TIP_COMPLETION_POINTS} Green Points).`,
      "completedTips",
      tip.id || tip.title,
    );
  },

  /**
   * Marks an article as read and awards {@link ARTICLE_READ_POINTS} points.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @param {Object} article - Article object with `id` or `url`, and `title`.
   * @returns {Promise<{awarded: boolean, profile: Object}>}
   */
  async markArticleRead(user, article) {
    return this.addGreenPoints(
      user,
      ARTICLE_READ_POINTS,
      `Read article: ${article.title} (+${ARTICLE_READ_POINTS} Green Points).`,
      "readArticles",
      article.id || article.url,
    );
  },

  /**
   * Retrieves the top-{@link LEADERBOARD_LIMIT} leaderboard, sorted by
   * green points descending. Returns demo data when offline.
   * @param {Object|null} user - Serialised user, or null/demo.
   * @returns {Promise<Array<Object>>} Leaderboard entries.
   */
  async getLeaderboard(user) {
    if (!user || user.isDemo) {
      const profile = getDemoProfile();
      return [
        { displayName: profile.displayName, greenPoints: profile.greenPoints, photoURL: profile.photoURL },
        { displayName: "Aarav M.", greenPoints: 520 },
        { displayName: "Nisha R.", greenPoints: 460 },
        { displayName: "Devika S.", greenPoints: 390 },
        { displayName: "Kabir A.", greenPoints: 340 },
        { displayName: "Ira P.", greenPoints: 290 },
        { displayName: "Rohan K.", greenPoints: 255 },
        { displayName: "Maya D.", greenPoints: 230 },
        { displayName: "Tara V.", greenPoints: 205 },
        { displayName: "Vihaan G.", greenPoints: 180 },
      ].sort((a, b) => b.greenPoints - a.greenPoints);
    }
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const leaderboardQuery = dbMod.query(
      dbMod.collection(db, "publicProfiles"),
      dbMod.orderBy("greenPoints", "desc"),
      dbMod.limit(LEADERBOARD_LIMIT),
    );
    const snap = await dbMod.getDocs(leaderboardQuery);
    return snap.docs.map((docSnap) => docSnap.data());
  },
};
