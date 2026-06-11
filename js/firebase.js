/**
 * @module firebase
 * @description EcoTrace Firebase service layer. Provides authentication,
 * Firestore profile management, footprint tracking, green-points scoring,
 * and a leaderboard — with seamless local-storage fallback ("demo mode")
 * when Firebase credentials are not configured.
 */
import {
  readJson, writeJson,
  getDemoProfile, saveDemoProfile,
  addActivity,
  getLocalFootprints, STORAGE_KEYS,
  DEFAULT_DISPLAY_NAME, MAX_FOOTPRINT_RECORDS,
} from "./demo-store.js";

import {
  initFirebase, serializeFirebaseUser, ensureUserDocument,
  authService,
} from "./firebase-auth.js";

/* ── Named constants (firebase-specific) ───────────────────────────── */

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
  /* ── Auth methods (delegated to firebase-auth.js) ──────────────── */
  ...authService,

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
