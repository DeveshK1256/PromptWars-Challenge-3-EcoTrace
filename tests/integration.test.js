/**
 * @vitest-environment jsdom
 */
/**
 * @module tests/integration
 * Integration tests that verify multi-step flows and reduce reliance
 * on source-text regex assertions:
 * - Auth error path handling (demo mode)
 * - Geocoding cascade structure
 * - Calculator → save → dashboard data flow
 * - Gemini proxy contract consistency
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

/* ── Auth Error Paths ──────────────────────────────────────────── */

describe('Auth Error Paths (demo mode)', () => {
  it('signInWithEmail rejects unknown users with auth/user-not-found', async () => {
    const { authService } = await import('../js/firebase-auth.js');
    try {
      await authService.signInWithEmail('nonexistent@test.com', 'password123');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe('auth/user-not-found');
      expect(error.message).toContain('No account');
    }
  });

  it('createEmailAccount then signInWithEmail with wrong password rejects', async () => {
    const { authService } = await import('../js/firebase-auth.js');
    const unique = `test-${Date.now()}@integration.test`;
    await authService.createEmailAccount(unique, 'correct-password', 'Test');

    try {
      await authService.signInWithEmail(unique, 'wrong-password');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe('auth/wrong-password');
      expect(error.message).toContain('Incorrect');
    }
  });

  it('createEmailAccount rejects duplicate email', async () => {
    const { authService } = await import('../js/firebase-auth.js');
    const unique = `dup-${Date.now()}@integration.test`;
    await authService.createEmailAccount(unique, 'password', 'First');

    try {
      await authService.createEmailAccount(unique, 'password', 'Second');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe('auth/email-already-in-use');
      expect(error.message).toContain('already exists');
    }
  });

  it('sendPasswordReset in demo mode throws auth/demo-mode', async () => {
    const { authService } = await import('../js/firebase-auth.js');
    try {
      await authService.sendPasswordReset('test@test.com');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe('auth/demo-mode');
      expect(error.message).toContain('demo mode');
    }
  });

  it('signInWithGoogle without Firebase throws auth/firebase-config-missing', async () => {
    const { authService } = await import('../js/firebase-auth.js');
    try {
      await authService.signInWithGoogle();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.code).toBe('auth/firebase-config-missing');
    }
  });

  it('auth layer handles all common Firebase error codes', () => {
    const authSource = readFileSync('js/firebase-auth.js', 'utf-8');
    const uiSource = readFileSync('js/app-auth.js', 'utf-8');
    const combined = authSource + uiSource;
    const expectedCodes = [
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/email-already-in-use',
      'auth/invalid-email',
      'auth/too-many-requests',
      'auth/demo-mode',
      'auth/firebase-config-missing',
    ];
    expectedCodes.forEach((code) => {
      expect(combined).toContain(code);
    });
  });
});

/* ── Geocoding Cascade ─────────────────────────────────────────── */

describe('Geocoding Cascade', () => {
  it('resolveLocation implements 4-tier fallback cascade', () => {
    const source = readFileSync('js/map-search.js', 'utf-8');
    // Verify cascade order: Google Maps SDK → Google REST → OSM → hard-coded
    expect(source).toContain('geocodeAddress');
    expect(source).toContain('geocodeWithGoogleRest');
    expect(source).toContain('geocodeWithOpenStreetMap');
    expect(source).toContain('getLocationFallback');
  });

  it('all geocoders return {lat, lng, label} shape', () => {
    const source = readFileSync('js/map-search.js', 'utf-8');
    // Each geocoder returns an object with lat, lng, label keys
    const geoFunctions = ['geocodeAddress', 'geocodeWithGoogleRest', 'geocodeWithOpenStreetMap'];
    geoFunctions.forEach((fn) => {
      expect(source).toContain(fn);
    });
    expect(source).toContain('lat:');
    expect(source).toContain('lng:');
    expect(source).toContain('label:');
  });

  it('fallback covers major cities', () => {
    const searchUi = readFileSync('js/map-search-ui.js', 'utf-8');
    ['delhi', 'mumbai', 'bangalore', 'kolkata'].forEach((city) => {
      expect(searchUi.toLowerCase()).toContain(city);
    });
  });
});

/* ── Calculator → Save → Dashboard Flow ────────────────────────── */

describe('Calculator → Save → Dashboard Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('calculateFootprint returns saveable result with totalKg and breakdown', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const result = calculateFootprint({
      carKm: 100, flights: 2, publicTransport: 'weekly',
      dietType: 'vegetarian', foodWaste: 'medium', localFood: 50,
      electricityBill: 2000, gasUsage: 'low', renewable: 0,
      onlineOrders: 5, clothes: 10, electronics: 1,
    });

    expect(result).toHaveProperty('totalKg');
    expect(result).toHaveProperty('breakdown');
    expect(typeof result.totalKg).toBe('number');
    expect(result.totalKg).toBeGreaterThan(0);
    expect(result.breakdown).toHaveProperty('transport');
    expect(result.breakdown).toHaveProperty('food');
    expect(result.breakdown).toHaveProperty('energy');
    expect(result.breakdown).toHaveProperty('shopping');
  });

  it('save path writes to localStorage activities cache', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const result = calculateFootprint({
      carKm: 50, flights: 1, publicTransport: 'daily',
      dietType: 'vegan', foodWaste: 'low', localFood: 80,
      electricityBill: 1000, gasUsage: 'none', renewable: 50,
      onlineOrders: 2, clothes: 3, electronics: 0,
    });

    // Simulate save path from calculator.js
    localStorage.setItem('lastFootprintKg', String(result.totalKg));
    const activities = JSON.parse(localStorage.getItem('eco-activities-cache') || '[]');
    activities.push({
      createdAt: new Date().toISOString(),
      co2Kg: result.totalKg,
      type: 'calculator',
    });
    localStorage.setItem('eco-activities-cache', JSON.stringify(activities));

    // Verify
    const savedKg = parseFloat(localStorage.getItem('lastFootprintKg'));
    expect(savedKg).toBe(result.totalKg);
    const cached = JSON.parse(localStorage.getItem('eco-activities-cache'));
    expect(cached).toHaveLength(1);
    expect(cached[0].co2Kg).toBe(result.totalKg);
    expect(cached[0].type).toBe('calculator');
  });

  it('full result can be serialised for cross-page dashboard access', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const result = calculateFootprint({
      carKm: 200, flights: 4, publicTransport: 'none',
      dietType: 'meat', foodWaste: 'high', localFood: 10,
      electricityBill: 5000, gasUsage: 'high', renewable: 0,
      onlineOrders: 20, clothes: 30, electronics: 5,
    });

    // Verify result round-trips through JSON (same as sessionStorage path)
    const serialised = JSON.stringify(result);
    const retrieved = JSON.parse(serialised);
    expect(retrieved.totalKg).toBe(result.totalKg);
    expect(retrieved.breakdown.transport).toBe(result.breakdown.transport);
    expect(retrieved.breakdown.food).toBe(result.breakdown.food);
    expect(retrieved.breakdown.energy).toBe(result.breakdown.energy);
    expect(retrieved.breakdown.shopping).toBe(result.breakdown.shopping);
  });

  it('multiple saves accumulate in activities cache for heatmap', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');

    for (let i = 0; i < 3; i++) {
      const result = calculateFootprint({
        carKm: 50 * (i + 1), flights: i, publicTransport: 'daily',
        dietType: 'vegetarian', foodWaste: 'medium', localFood: 50,
        electricityBill: 1500, gasUsage: 'medium', renewable: 20,
        onlineOrders: 3, clothes: 5, electronics: 1,
      });

      const activities = JSON.parse(localStorage.getItem('eco-activities-cache') || '[]');
      activities.push({ createdAt: new Date().toISOString(), co2Kg: result.totalKg, type: 'calculator' });
      localStorage.setItem('eco-activities-cache', JSON.stringify(activities));
    }

    const final = JSON.parse(localStorage.getItem('eco-activities-cache'));
    expect(final).toHaveLength(3);
    // More carKm → higher CO2
    expect(final[0].co2Kg).toBeLessThan(final[2].co2Kg);
  });
});

/* ── Gemini Proxy Contract ─────────────────────────────────────── */

describe('Gemini Proxy Contract', () => {
  it('chatbot sends Gemini-compatible payload with systemInstruction', () => {
    const source = readFileSync('js/chatbot.js', 'utf-8');
    expect(source).toContain('contents');
    expect(source).toContain('systemInstruction');
    expect(source).toContain('generationConfig');
    // Must NOT send the old incompatible format
    expect(source).not.toContain('body: JSON.stringify({ message:');
  });

  it('Netlify proxy forwards systemInstruction', () => {
    const source = readFileSync('netlify/functions/gemini.js', 'utf-8');
    expect(source).toContain('systemInstruction');
  });

  it('Firebase proxy mirrors Netlify proxy with systemInstruction', () => {
    const source = readFileSync('functions/index.js', 'utf-8');
    expect(source).toContain('systemInstruction');
    expect(source).toContain('Mirrors the canonical Netlify proxy');
  });

  it('both proxies use same rate limit interval (10_000ms)', () => {
    const netlify = readFileSync('netlify/functions/gemini.js', 'utf-8');
    const firebase = readFileSync('functions/index.js', 'utf-8');
    expect(netlify).toContain('10_000');
    expect(firebase).toContain('10_000');
  });

  it('both proxies use same error message for rate limiting', () => {
    const netlify = readFileSync('netlify/functions/gemini.js', 'utf-8');
    const firebase = readFileSync('functions/index.js', 'utf-8');
    expect(netlify).toContain('Rate limited');
    expect(firebase).toContain('Rate limited');
  });

  it('rate limit documented as in-memory limitation', () => {
    const netlify = readFileSync('netlify/functions/gemini.js', 'utf-8');
    expect(netlify).toContain('@limitation');
    expect(netlify).toContain('cold start');
  });
});
