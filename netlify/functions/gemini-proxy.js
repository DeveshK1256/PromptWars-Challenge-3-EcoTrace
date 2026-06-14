/**
 * @module gemini-proxy
 * Netlify serverless function that proxies Gemini API calls.
 * Keeps the Gemini API key server-side so it is never exposed to the browser.
 *
 * Endpoint: POST /api/gemini
 * Expects JSON body with `contents`, `generationConfig`, and optional `model`.
 */

/* global Response, process */

/** @type {string} Default Gemini model when the client doesn't specify one. */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** @type {string} Base URL for the Gemini generateContent REST API. */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Netlify edge-function handler that forwards requests to the Gemini API.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} The proxied Gemini API response (or an error).
 */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
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

export const config = { path: '/api/gemini' };
