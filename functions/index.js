/**
 * @module ecotrace-functions
 * Firebase Cloud Functions for EcoTrace.
 * Handles scheduled tasks, Firestore triggers, and the Gemini API proxy.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();

/* ── Rate limiter state ──────────────────────────────────────────── */

/** @type {Map<string, number>} Maps client IP to last request timestamp. */
const rateLimitMap = new Map();

/** @type {number} Minimum milliseconds between Gemini proxy calls per IP. */
const RATE_LIMIT_MS = 10_000;

/** @type {number} Maximum leaderboard entries to cache. */
const LEADERBOARD_LIMIT = 100;

/** @type {number} HTTP 405 – Method Not Allowed. */
const HTTP_METHOD_NOT_ALLOWED = 405;

/** @type {number} HTTP 429 – Too Many Requests. */
const HTTP_TOO_MANY_REQUESTS = 429;

/** @type {number} HTTP 500 – Internal Server Error. */
const HTTP_INTERNAL_ERROR = 500;

/** @type {number} India average CO₂ kg/year threshold for positive messaging. */
const INDIA_AVG_CO2_KG = 1900;

/* ── 1. Scheduled: Aggregate leaderboard daily ───────────────────── */

/**
 * Runs daily at midnight UTC. Reads all publicProfiles, sorts by greenPoints,
 * and writes a cached leaderboard snapshot to `leaderboardCache/latest`.
 * @returns {Promise<void>}
 */
export const aggregateLeaderboard = onSchedule('every day 00:00', async () => {
  const snapshot = await db.collection('publicProfiles')
    .orderBy('greenPoints', 'desc')
    .limit(LEADERBOARD_LIMIT)
    .get();

  const entries = snapshot.docs.map((doc) => ({
    uid: doc.id,
    displayName: doc.data().displayName || 'Anonymous',
    photoURL: doc.data().photoURL || '',
    greenPoints: doc.data().greenPoints || 0,
  }));

  await db.doc('leaderboardCache/latest').set({
    entries,
    updatedAt: new Date().toISOString(),
    count: entries.length,
  });
});

/* ── 2. Trigger: New footprint → push notification ───────────────── */

/**
 * Fires when a new footprint document is created under any user.
 * Sends a Firebase Cloud Messaging notification summarising the entry.
 * @param {Object} event - Firestore event with snapshot and params.
 * @returns {Promise<void>}
 */
export const onFootprintCreated = onDocumentCreated(
  'users/{userId}/footprints/{footprintId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const userId = event.params.userId;
    const totalKg = data.totalKg || 0;

    // Read user's FCM token (if stored)
    const userDoc = await db.doc(`users/${userId}`).get();
    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) return;

    const belowAverage = totalKg < INDIA_AVG_CO2_KG;
    const bodyText = `Your latest carbon footprint: ${totalKg.toLocaleString()} kg CO₂/year. `
      + (belowAverage
        ? 'Below India average! 🎉'
        : 'Check tips to reduce further.');

    const message = {
      token: fcmToken,
      notification: {
        title: 'New Footprint Recorded 🌱',
        body: bodyText,
      },
      data: {
        footprintId: event.params.footprintId,
        totalKg: String(totalKg),
      },
    };

    try {
      await getMessaging().send(message);
    } catch (error) {
      console.error('FCM send error:', error);
    }
  },
);

/* ── 3. HTTPS: Gemini API proxy ──────────────────────────────────── */

/** @type {string} Default Gemini model used when client doesn't specify one. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-lite';

/**
 * Proxies Gemini API calls to keep the API key server-side.
 * Includes rate limiting (one call per {@link RATE_LIMIT_MS} ms per IP).
 * @param {Object} req - HTTP request.
 * @param {Object} res - HTTP response.
 * @returns {Promise<void>}
 */
export const geminiProxy = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(HTTP_METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
      return;
    }

    // Rate limiting
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const lastCall = rateLimitMap.get(clientIp) || 0;
    if (now - lastCall < RATE_LIMIT_MS) {
      res.status(HTTP_TOO_MANY_REQUESTS).json({
        error: 'Rate limit exceeded. Try again in 10 seconds.',
      });
      return;
    }
    rateLimitMap.set(clientIp, now);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(HTTP_INTERNAL_ERROR).json({ error: 'Gemini API key not configured' });
      return;
    }

    try {
      const { contents, generationConfig, model } = req.body;
      const modelName = model || DEFAULT_GEMINI_MODEL;
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/`
        + `${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig }),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(HTTP_INTERNAL_ERROR).json({ error: 'Proxy error' });
    }
  },
);
