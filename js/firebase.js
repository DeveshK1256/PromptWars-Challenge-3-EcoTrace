/**
 * @module firebase
 * @description EcoTrace Firebase service layer. Provides authentication,
 * Firestore profile management, footprint tracking, green-points scoring,
 * and a leaderboard — with seamless local-storage fallback ("demo mode")
 * when Firebase credentials are not configured.
 */
import { ECO_CONFIG, hasFirebaseConfig } from "./config.js";

/* ── Named constants ───────────────────────────────────────────────── */

/** Maximum length for a user display name. */
const MAX_DISPLAY_NAME_LENGTH = 80;

/** Maximum length for a user photo URL. */
const MAX_PHOTO_URL_LENGTH = 400;

/** Maximum number of footprint records kept per user. */
const MAX_FOOTPRINT_RECORDS = 24;

/** Maximum number of activity entries kept in demo mode. */
const MAX_ACTIVITY_ENTRIES = 20;

/** Number of leaderboard entries to fetch. */
const LEADERBOARD_LIMIT = 10;

/** Maximum number of activities returned from Firestore. */
const ACTIVITY_QUERY_LIMIT = 12;

/** Default display name for new users. */
const DEFAULT_DISPLAY_NAME = "EcoTracer";

/** Default demo guest display name. */
const DEFAULT_DEMO_GUEST_NAME = "Eco Guest";

/** Default demo guest email. */
const DEFAULT_DEMO_EMAIL = "demo@ecotrace.local";

/** Default demo green-points value. */
const DEFAULT_DEMO_GREEN_POINTS = 125;

/** Default demo CO₂ saved value. */
const DEFAULT_DEMO_CO2_SAVED = 340;

/** Default demo challenges completed. */
const DEFAULT_DEMO_CHALLENGES = 2;

/** Default demo streak value. */
const DEFAULT_DEMO_STREAK = 5;

/** Points awarded for completing a tip. */
const TIP_COMPLETION_POINTS = 10;

/** Points awarded for reading an article. */
const ARTICLE_READ_POINTS = 5;

/** Hash multiplier used in the fallback (non-SubtleCrypto) hashing algorithm. */
const HASH_MULTIPLIER = 31;

const STORAGE_KEYS = Object.freeze({
  profile: "ecotrace.profile",
  footprints: "ecotrace.footprints",
  activities: "ecotrace.activities",
  demoAccounts: "ecotrace.demoAccounts",
});

const DEMO_UID = "demo-user";
const DEFAULT_PROFILE = Object.freeze({
  uid: DEMO_UID,
  displayName: DEFAULT_DEMO_GUEST_NAME,
  email: DEFAULT_DEMO_EMAIL,
  photoURL: "",
  greenPoints: DEFAULT_DEMO_GREEN_POINTS,
  co2Saved: DEFAULT_DEMO_CO2_SAVED,
  challengesCompleted: DEFAULT_DEMO_CHALLENGES,
  completedTips: [],
  acceptedChallenges: ["unplug-devices"],
  readArticles: [],
  badgesEarned: ["seedling", "starter"],
  streak: DEFAULT_DEMO_STREAK,
  isDemo: true,
});

let firebasePromise;
let firebaseRuntime;

/**
 * Reads and parses a JSON value from localStorage.
 * @param {string} key - The localStorage key.
 * @param {*} fallback - Value returned when the key is missing or unparseable.
 * @returns {*} The parsed value or the fallback.
 */
function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`EcoTrace could not read ${key}`, error);
    return fallback;
  }
}

/**
 * Serialises a value to JSON and writes it to localStorage.
 * @param {string} key - The localStorage key.
 * @param {*} value - The value to serialise.
 */
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Normalises an email address to a lower-case, trimmed string.
 * @param {string} email - The raw email address.
 * @returns {string} Normalised email.
 */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Creates an Error object with a Firebase-style `.code` property.
 * @param {string} code - The error code (e.g. "auth/wrong-password").
 * @param {string} message - Human-readable error message.
 * @returns {Error} The decorated Error instance.
 */
function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Hashes a demo-mode password using SHA-256 (Web Crypto) or a simple
 * numeric fallback when SubtleCrypto is unavailable.
 * @param {string} email - User email (used as a salt).
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Hex-encoded hash string.
 */
async function hashDemoPassword(email, password) {
  const value = `${normalizeEmail(email)}:${String(password || "")}`;
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * HASH_MULTIPLIER + value.charCodeAt(index)) >>> 0;
  }
  return `fallback-${hash.toString(16)}`;
}

/**
 * Reads the map of demo accounts from localStorage.
 * @returns {Object<string, Object>} Account map keyed by normalised email.
 */
function readDemoAccounts() {
  return readJson(STORAGE_KEYS.demoAccounts, {});
}

/**
 * Persists the demo accounts map to localStorage.
 * @param {Object<string, Object>} accounts - Account map to save.
 */
function writeDemoAccounts(accounts) {
  writeJson(STORAGE_KEYS.demoAccounts, accounts);
}

/**
 * Creates a sanitised snapshot of a demo profile with guaranteed field types.
 * @param {Object} profile - Raw profile data.
 * @returns {Object} Clean profile snapshot.
 */
function demoProfileSnapshot(profile) {
  return {
    displayName: profile.displayName || DEFAULT_DISPLAY_NAME,
    email: normalizeEmail(profile.email),
    photoURL: profile.photoURL || "",
    greenPoints: Number(profile.greenPoints || 0),
    co2Saved: Number(profile.co2Saved || 0),
    challengesCompleted: Number(profile.challengesCompleted || 0),
    completedTips: Array.isArray(profile.completedTips) ? profile.completedTips : [],
    acceptedChallenges: Array.isArray(profile.acceptedChallenges) ? profile.acceptedChallenges : [],
    readArticles: Array.isArray(profile.readArticles) ? profile.readArticles : [],
    badgesEarned: Array.isArray(profile.badgesEarned) ? profile.badgesEarned : [],
    streak: Number(profile.streak || 0),
  };
}

/**
 * Creates a fresh demo-mode account profile with zeroed stats.
 * @param {string} email - The account email.
 * @param {string} displayName - The account display name.
 * @returns {Object} New profile snapshot.
 */
function createDemoAccountProfile(email, displayName) {
  return demoProfileSnapshot({
    displayName,
    email,
    photoURL: "",
    greenPoints: 0,
    co2Saved: 0,
    challengesCompleted: 0,
    completedTips: [],
    acceptedChallenges: [],
    readArticles: [],
    badgesEarned: [],
    streak: 0,
  });
}

/**
 * Prepends an activity log entry to local storage (demo mode).
 * @param {string} message - Human-readable activity description.
 * @param {string} [type="info"] - Activity type tag (e.g. "auth", "points").
 */
function addActivity(message, type = "info") {
  const activities = readJson(STORAGE_KEYS.activities, []);
  activities.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    message,
    type,
    createdAt: new Date().toISOString(),
  });
  writeJson(STORAGE_KEYS.activities, activities.slice(0, MAX_ACTIVITY_ENTRIES));
}

/**
 * Retrieves (or initialises) the current demo-mode profile from localStorage.
 * @returns {Object} The demo user profile with `isDemo: true`.
 */
function getDemoProfile() {
  const stored = readJson(STORAGE_KEYS.profile, null);
  if (stored) return { ...DEFAULT_PROFILE, ...stored, isDemo: true };
  writeJson(STORAGE_KEYS.profile, DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE };
}

/**
 * Merges updates into the demo profile and persists to localStorage.
 * Also updates the matching demo-account record if one exists.
 * @param {Object} nextProfile - Partial profile fields to merge.
 * @returns {Object} The merged and persisted profile.
 */
function saveDemoProfile(nextProfile) {
  const profile = { ...getDemoProfile(), ...nextProfile, uid: DEMO_UID, isDemo: true };
  writeJson(STORAGE_KEYS.profile, profile);
  const accounts = readDemoAccounts();
  const accountKey = normalizeEmail(profile.email);
  if (accountKey && accounts[accountKey]) {
    accounts[accountKey] = {
      ...accounts[accountKey],
      displayName: profile.displayName,
      photoURL: profile.photoURL || "",
      profile: demoProfileSnapshot(profile),
      updatedAt: new Date().toISOString(),
    };
    writeDemoAccounts(accounts);
  }
  return profile;
}

/**
 * Deletes every document in a Firestore query snapshot.
 * @param {Object} dbMod - The Firestore module.
 * @param {Object} querySnapshot - The snapshot whose docs should be deleted.
 * @returns {Promise<void>}
 */
async function deleteQuerySnapshot(dbMod, querySnapshot) {
  await Promise.all(querySnapshot.docs.map((docSnap) => dbMod.deleteDoc(docSnap.ref)));
}

/**
 * Returns an ISO date string for `index` months before the current date.
 * @param {number} index - Number of months to subtract.
 * @returns {string} ISO 8601 date string.
 */
function monthAgo(index) {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return date.toISOString();
}

/**
 * Generates six seed footprint records spanning the last five months.
 * @returns {Array<Object>} Array of footprint record objects.
 */
function seedFootprints() {
  return [
    {
      id: "seed-0",
      totalKg: 2870,
      date: monthAgo(5),
      breakdown: { transport: 850, food: 820, energy: 720, shopping: 480 },
      formData: {},
    },
    {
      id: "seed-1",
      totalKg: 2680,
      date: monthAgo(4),
      breakdown: { transport: 790, food: 780, energy: 680, shopping: 430 },
      formData: {},
    },
    {
      id: "seed-2",
      totalKg: 2490,
      date: monthAgo(3),
      breakdown: { transport: 710, food: 760, energy: 630, shopping: 390 },
      formData: {},
    },
    {
      id: "seed-3",
      totalKg: 2320,
      date: monthAgo(2),
      breakdown: { transport: 640, food: 720, energy: 590, shopping: 370 },
      formData: {},
    },
    {
      id: "seed-4",
      totalKg: 2195,
      date: monthAgo(1),
      breakdown: { transport: 590, food: 690, energy: 565, shopping: 350 },
      formData: {},
    },
    {
      id: "seed-5",
      totalKg: 2040,
      date: new Date().toISOString(),
      breakdown: { transport: 520, food: 650, energy: 535, shopping: 335 },
      formData: {},
    },
  ];
}

/**
 * Reads footprints from localStorage, seeding defaults on first access.
 * @returns {Array<Object>} Array of footprint records.
 */
function getLocalFootprints() {
  const existing = readJson(STORAGE_KEYS.footprints, null);
  if (existing && existing.length) return existing;
  const seeded = seedFootprints();
  writeJson(STORAGE_KEYS.footprints, seeded);
  return seeded;
}

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

/**
 * Fetches the full user profile from Firestore, falling back to demo
 * profile when Firebase is unavailable.
 * @param {Object} user - Serialised user object.
 * @returns {Promise<Object>} Merged profile data.
 */
async function getRemoteProfile(user) {
  const runtime = await initFirebase();
  if (!runtime || !user) return getDemoProfile();
  const { db, dbMod } = runtime;
  await ensureUserDocument(user);
  const snap = await dbMod.getDoc(dbMod.doc(db, "users", user.uid));
  return {
    ...serializeFirebaseUser(user),
    ...(snap.exists() ? snap.data() : {}),
  };
}

export const ecoService = {
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
        "auth/firebase-config-missing",
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
        "auth/demo-mode",
        "You're in demo mode — accounts are stored locally in your browser. "
          + "Password reset emails cannot be sent. Try signing in with the password "
          + "you used to create the account, or create a new account.",
      );
    }
    try {
      await runtime.authMod.sendPasswordResetEmail(runtime.auth, email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        throw createAuthError(
          "auth/user-not-found",
          "This email is not registered in Firebase. If you created your account "
            + "while offline or in demo mode, it only exists locally. "
            + "Please create a new account.",
        );
      }
      if (err.code === "auth/invalid-email") {
        throw createAuthError("auth/invalid-email", "Please enter a valid email address.");
      }
      if (err.code === "auth/too-many-requests") {
        throw createAuthError("auth/too-many-requests", "Too many attempts. Please try again later.");
      }
      console.error("Password reset error:", err);
      throw err;
    }
  },

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
