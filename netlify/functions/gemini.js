/**
 * @module gemini
 * Netlify serverless function that proxies Gemini API calls.
 * Keeps the Gemini API key server-side so it is never exposed to the browser.
 * Includes per-IP rate limiting (one call per 10 seconds) via Netlify Blobs,
 * input sanitization, and CORS origin validation.
 *
 * Endpoint: POST /.netlify/functions/gemini
 * Expects JSON body with `contents`, `generationConfig`, and optional `model`.
 */

/* global Response, process */
import { getStore } from '@netlify/blobs';

/** @type {string} Default Gemini model when the client doesn't specify one. */
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

/** @type {string} Base URL for the Gemini generateContent REST API. */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** @type {number} Minimum interval (ms) between calls from the same IP. */
const RATE_LIMIT_MS = 10_000;

/** @type {string[]} Origins allowed to call this function. */
const ALLOWED_ORIGINS = ['https://eco-tracee.netlify.app', 'http://localhost:8888'];

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
 * Checks whether the given IP is rate-limited using persistent storage.
 * Uses Netlify Blobs as a durable KV store so rate-limit state survives
 * cold starts and is shared across function instances.
 *
 * @param {string} ip - Client IP address.
 * @returns {Promise<boolean>} True if rate-limited.
 */
async function isRateLimited(ip) {
  const store = getStore('rate-limits');
  const key = `rl-${ip.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const now = Date.now();

  try {
    const lastCallStr = await store.get(key);
    const lastCall = lastCallStr ? Number(lastCallStr) : 0;
    if (now - lastCall < RATE_LIMIT_MS) {
      return true;
    }
    await store.set(key, String(now));
    return false;
  } catch {
    // If blobs fail, allow the request rather than blocking users
    return false;
  }
}

/**
 * Sanitizes user input before forwarding to Gemini API.
 * Strips HTML tags and enforces a maximum character length.
 *
 * @param {string} text - Raw user input.
 * @returns {string} Sanitized text.
 */
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text.slice(0, 2000).replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes all user-provided text parts within a `contents` array.
 * Each content item may contain a `parts` array with `text` fields.
 *
 * @param {Array} contents - The Gemini API contents array.
 * @returns {Array} Contents with sanitized text parts.
 */
function sanitizeContents(contents) {
  if (!Array.isArray(contents)) return contents;
  return contents.map((item) => {
    if (!item.parts || !Array.isArray(item.parts)) return item;
    return {
      ...item,
      parts: item.parts.map((part) =>
        typeof part.text === 'string' ? { ...part, text: sanitizeInput(part.text) } : part
      ),
    };
  });
}

/**
 * Checks whether the request origin is in the allowed list.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {{ allowed: boolean, origin: string }} Validation result.
 */
function validateOrigin(request) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const isAllowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) || !origin;
  return { allowed: isAllowed, origin };
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

  /* ── CORS origin validation ─────────────────────────────────── */
  const { allowed, origin } = validateOrigin(request);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const corsOrigin = origin || ALLOWED_ORIGINS[0];

  /* ── Rate limiting ──────────────────────────────────────────── */
  const ip = getClientIp(request);
  if (await isRateLimited(ip)) {
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
        contents: sanitizeContents(body.contents),
        systemInstruction: body.systemInstruction,
        generationConfig: body.generationConfig,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
