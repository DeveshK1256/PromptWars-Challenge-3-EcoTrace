import { ECO_CONFIG, hasFirebaseConfig } from "./config.js?v=firebase-config-16";

const STORAGE_KEYS = Object.freeze({
  profile: "ecotrace.profile",
  footprints: "ecotrace.footprints",
  activities: "ecotrace.activities",
  demoAccounts: "ecotrace.demoAccounts",
});

const DEMO_UID = "demo-user";
const DEFAULT_PROFILE = Object.freeze({
  uid: DEMO_UID,
  displayName: "Eco Guest",
  email: "demo@ecotrace.local",
  photoURL: "",
  greenPoints: 125,
  co2Saved: 340,
  challengesCompleted: 2,
  completedTips: [],
  acceptedChallenges: ["unplug-devices"],
  readArticles: [],
  badgesEarned: ["seedling", "starter"],
  streak: 5,
  isDemo: true,
});

let firebasePromise;
let firebaseRuntime;

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`EcoTrace could not read ${key}`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function hashDemoPassword(email, password) {
  const value = `${normalizeEmail(email)}:${String(password || "")}`;
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `fallback-${hash.toString(16)}`;
}

function readDemoAccounts() {
  return readJson(STORAGE_KEYS.demoAccounts, {});
}

function writeDemoAccounts(accounts) {
  writeJson(STORAGE_KEYS.demoAccounts, accounts);
}

function demoProfileSnapshot(profile) {
  return {
    displayName: profile.displayName || "EcoTracer",
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

function addActivity(message, type = "info") {
  const activities = readJson(STORAGE_KEYS.activities, []);
  activities.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    message,
    type,
    createdAt: new Date().toISOString(),
  });
  writeJson(STORAGE_KEYS.activities, activities.slice(0, 20));
}

function getDemoProfile() {
  const stored = readJson(STORAGE_KEYS.profile, null);
  if (stored) return { ...DEFAULT_PROFILE, ...stored, isDemo: true };
  writeJson(STORAGE_KEYS.profile, DEFAULT_PROFILE);
  return { ...DEFAULT_PROFILE };
}

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

async function deleteQuerySnapshot(dbMod, querySnapshot) {
  await Promise.all(querySnapshot.docs.map((docSnap) => dbMod.deleteDoc(docSnap.ref)));
}

function monthAgo(index) {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return date.toISOString();
}

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

function getLocalFootprints() {
  const existing = readJson(STORAGE_KEYS.footprints, null);
  if (existing && existing.length) return existing;
  const seeded = seedFootprints();
  writeJson(STORAGE_KEYS.footprints, seeded);
  return seeded;
}

function serializeFirebaseUser(user) {
  return user
    ? {
        uid: user.uid,
        displayName: user.displayName || "EcoTracer",
        email: user.email || "",
        photoURL: user.photoURL || "",
        isDemo: false,
      }
    : null;
}

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
        displayName: user.displayName || "EcoTracer",
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
          displayName: user.displayName || publicSnap.data().displayName || "EcoTracer",
          photoURL: user.photoURL || publicSnap.data().photoURL || "",
          updatedAt: dbMod.serverTimestamp(),
        }
      : {
          displayName: user.displayName || "EcoTracer",
          photoURL: user.photoURL || "",
          greenPoints: privateScore,
          updatedAt: dbMod.serverTimestamp(),
        },
    { merge: true },
  );
  return userRef;
}

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
  async isConfigured() {
    return hasFirebaseConfig();
  },

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

  async getCurrentUser() {
    const runtime = await initFirebase();
    if (!runtime) return getDemoProfile();
    return serializeFirebaseUser(runtime.auth.currentUser);
  },

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

  async createEmailAccount(email, password, displayName = "EcoTracer") {
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

  async signOut() {
    const runtime = await initFirebase();
    if (!runtime) {
      addActivity("Returned to demo guest mode.", "auth");
      saveDemoProfile(DEFAULT_PROFILE);
      return;
    }
    await runtime.authMod.signOut(runtime.auth);
  },

  async getProfile(user) {
    if (!user || user.isDemo) return getDemoProfile();
    return getRemoteProfile(user);
  },

  async updateUserProfile(user, updates) {
    const cleanUpdates = {
      displayName: String(updates.displayName || "").trim().slice(0, 80),
      photoURL: String(updates.photoURL || "").trim().slice(0, 400),
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
      writeJson(STORAGE_KEYS.footprints, [saved, ...footprints].slice(0, 24));
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

  async getFootprints(user) {
    if (!user || user.isDemo) return getLocalFootprints();
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const footprintsQuery = dbMod.query(
      dbMod.collection(db, "users", user.uid, "footprints"),
      dbMod.orderBy("createdAt", "desc"),
      dbMod.limit(24),
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

  async getActivities(user) {
    if (!user || user.isDemo) return readJson(STORAGE_KEYS.activities, []);
    const runtime = await initFirebase();
    const { db, dbMod } = runtime;
    const activityQuery = dbMod.query(
      dbMod.collection(db, "users", user.uid, "activities"),
      dbMod.orderBy("createdAt", "desc"),
      dbMod.limit(12),
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
        displayName: nextProfile.displayName || user.displayName || "EcoTracer",
        photoURL: nextProfile.photoURL || user.photoURL || "",
        greenPoints: Number(nextProfile.greenPoints || 0),
        updatedAt: dbMod.serverTimestamp(),
      },
      { merge: true },
    );
    return { awarded: true, profile: nextProfile };
  },

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

  async completeTip(user, tip) {
    return this.addGreenPoints(
      user,
      10,
      `Completed tip: ${tip.title} (+10 Green Points).`,
      "completedTips",
      tip.id || tip.title,
    );
  },

  async markArticleRead(user, article) {
    return this.addGreenPoints(
      user,
      5,
      `Read article: ${article.title} (+5 Green Points).`,
      "readArticles",
      article.id || article.url,
    );
  },

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
      dbMod.limit(10),
    );
    const snap = await dbMod.getDocs(leaderboardQuery);
    return snap.docs.map((docSnap) => docSnap.data());
  },
};
