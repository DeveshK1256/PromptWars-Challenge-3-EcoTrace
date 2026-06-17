/**
 * @module gemini
 * Netlify serverless function that proxies Gemini API calls.
 * Keeps the Gemini API key server-side so it is never exposed to the browser.
 * Includes per-IP rate limiting (one call per 10 seconds).
 *
 * @limitation Rate limiting uses an in-memory Map that resets on each cold start
 * and is local to a single function instance. This means:
 * - Concurrent instances each maintain separate rate-limit state
 * - A cold start resets the limiter for all IPs
 *
 * **Durable upgrade options (in priority order):**
 * 1. Netlify Blobs (`@netlify/blobs`) — zero-config KV store, simplest migration
 * 2. Upstash Redis (`@upstash/redis`) — sub-ms latency, free tier available
 * 3. Firestore counter doc — already available in the project's Firebase project
 *
 * For the current traffic level, in-memory limiting is sufficient as it still
 * throttles burst abuse within a single function instance lifetime.
 *
 * Endpoint: POST /.netlify/functions/gemini
 * Expects JSON body with `contents`, `generationConfig`, and optional `model`.
 */

/* global Response, process */

/** @type {string} Default Gemini model when the client doesn't specify one. */
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

/** @type {string} Base URL for the Gemini generateContent REST API. */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** @type {number} Minimum interval (ms) between calls from the same IP. */
const RATE_LIMIT_MS = 10_000;

/** @type {Map<string, number>} Maps client IP → timestamp of last allowed call. */
const rateLimitMap = new Map();

/**
 * Extracts the client IP address from the incoming request headers.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {string} The client IP, or 'unknown' if not determinable.
 */
function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('client-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Checks whether the given IP is rate-limited.
 * If not limited, records the current timestamp for that IP.
 *
 * @param {string} ip - The client IP address.
 * @returns {boolean} `true` if the request should be blocked, `false` if allowed.
 */
function isRateLimited(ip) {
  const now = Date.now();
  const lastCall = rateLimitMap.get(ip) || 0;
  if (now - lastCall < RATE_LIMIT_MS) {
    return true;
  }
  rateLimitMap.set(ip, now);
  return false;
}

/**
 * Netlify serverless handler that forwards requests to the Gemini API.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} The proxied Gemini API response (or an error).
 */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  /* ── Rate limiting ──────────────────────────────────────────── */
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Rate limited — please wait 10 seconds between requests.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const model = body.model || DEFAULT_MODEL;
    const url =
      `${GEMINI_API_BASE}/${model}` +
      `:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: body.contents,
        systemInstruction: body.systemInstruction,
        generationConfig: body.generationConfig,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
