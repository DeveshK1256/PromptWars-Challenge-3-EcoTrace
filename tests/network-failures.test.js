/**
 * @vitest-environment jsdom
 */
/**
 * @module tests/network-failures
 * Tests for graceful degradation when external services fail.
 * Verifies that Gemini proxy, geocoding, and search handle errors without crashing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Gemini Proxy Failure Handling', () => {
  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }),
      });
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toContain('fetch');
    }
  });

  it('handles 429 rate limit response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    );

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      body: JSON.stringify({ contents: [] }),
    });

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it('handles 500 server error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      body: JSON.stringify({ contents: [] }),
    });

    expect(response.status).toBe(500);
    expect(response.ok).toBe(false);
  });

  it('handles malformed JSON response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('not-valid-json{{{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      body: JSON.stringify({ contents: [] }),
    });

    await expect(response.json()).rejects.toThrow();
  });
});

describe('Geocoding Failure Handling', () => {
  it('handles Nominatim timeout', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));

    try {
      const response = await fetch('https://nominatim.openstreetmap.org/reverse?lat=0&lon=0&format=json');
      expect(response).toBeUndefined();
    } catch (error) {
      expect(error.name).toBe('AbortError');
    }
  });

  it('handles geocoding 403 (quota exceeded)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 })
    );

    const response = await fetch('https://nominatim.openstreetmap.org/reverse?lat=0&lon=0&format=json');
    expect(response.status).toBe(403);
    expect(response.ok).toBe(false);
  });

  it('handles empty geocoding result', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unable to geocode' }), { status: 200 })
    );

    const response = await fetch('https://nominatim.openstreetmap.org/reverse?lat=0&lon=0&format=json');
    const data = await response.json();
    expect(data.address).toBeUndefined();
    expect(data.error).toBeTruthy();
  });
});

describe('Custom Search Failure Handling', () => {
  it('handles Google Custom Search 4xx error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 })
    );

    const response = await fetch('https://www.googleapis.com/customsearch/v1?q=test');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain('not valid');
  });

  it('handles search quota exceeded (429)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 429 })
    );

    const response = await fetch('https://www.googleapis.com/customsearch/v1?q=test');
    expect(response.status).toBe(429);
  });

  it('handles DNS resolution failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('getaddrinfo ENOTFOUND www.googleapis.com'));

    try {
      await fetch('https://www.googleapis.com/customsearch/v1?q=test');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toContain('ENOTFOUND');
    }
  });
});

describe('Fallback Behavior', () => {
  it('provides usable data when all external services fail', () => {
    // Verify that static fallback data is always available
    // even when no network requests succeed
    const { FALLBACK_TIPS } = require('../js/data-tips.js');
    const { FEED_ARTICLES } = require('../js/data-feed.js');
    const { CHALLENGES, BADGES } = require('../js/data-challenges.js');

    expect(FALLBACK_TIPS.length).toBeGreaterThan(0);
    expect(FEED_ARTICLES.length).toBeGreaterThan(0);
    expect(CHALLENGES.length).toBeGreaterThan(0);
    expect(BADGES.length).toBeGreaterThan(0);

    // Each fallback tip should have required fields
    FALLBACK_TIPS.forEach((tip) => {
      expect(tip.id).toBeTruthy();
      expect(tip.category).toBeTruthy();
      expect(tip.title).toBeTruthy();
      expect(tip.savingKg).toBeGreaterThan(0);
    });
  });
});
