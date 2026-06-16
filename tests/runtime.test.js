/**
 * @module tests/runtime
 * Runtime tests that import and call actual module functions,
 * verifying real return values rather than scanning source text.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

/* ── Mocks for DOM-dependent modules ─────────────────────────────── */

// calculator.js imports app.js which touches `document` at top level.
// Mock all transitive DOM / Firebase dependencies so the pure
// calculation logic can be imported without a browser environment.

vi.mock('../js/app.js', () => ({
  appState: { user: null },
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  formatKg: (kg) => `${kg} kg`,
  onUserReady: vi.fn(),
  setButtonBusy: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../js/firebase.js', () => ({
  ecoService: {
    saveFootprint: vi.fn(),
  },
}));

vi.mock('../js/gemini.js', async (importOriginal) => {
  // Let the real gemini module load for its own tests below,
  // but provide a stub for calculator.js's import.
  const actual = await importOriginal();
  return {
    ...actual,
    getPersonalizedTips: vi.fn(),
  };
});

// ─── Calculator Runtime ─────────────────────────────────────────────

describe('Calculator Runtime', () => {
  it('calculateFootprint returns valid result', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const result = calculateFootprint({
      carKm: 100,
      flights: 2,
      publicTransport: 'weekly',
      dietType: 'vegetarian',
      foodWaste: 'medium',
      electricityBill: 2000,
      climateControl: false,
      renewable: false,
      onlineOrders: 5,
      clothes: 10,
      electronics: 1,
    });
    expect(result).toBeDefined();
    expect(typeof result.totalKg).toBe('number');
    expect(result.totalKg).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
    expect(typeof result.breakdown.transport).toBe('number');
    expect(typeof result.breakdown.food).toBe('number');
    expect(typeof result.breakdown.energy).toBe('number');
    expect(typeof result.breakdown.shopping).toBe('number');
  });

  it('calculateFootprint handles zero / minimal inputs', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const result = calculateFootprint({
      carKm: 0,
      flights: 0,
      publicTransport: 'none',
      dietType: 'vegan',
      foodWaste: 'low',
      electricityBill: 0,
      climateControl: false,
      renewable: false,
      onlineOrders: 0,
      clothes: 0,
      electronics: 0,
    });
    expect(result.totalKg).toBeGreaterThanOrEqual(0);
  });

  it('meat diet produces more food emissions than vegan', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const base = {
      carKm: 50,
      flights: 1,
      publicTransport: 'daily',
      foodWaste: 'medium',
      electricityBill: 1500,
      climateControl: false,
      renewable: false,
      onlineOrders: 3,
      clothes: 5,
      electronics: 1,
    };
    const vegan = calculateFootprint({ ...base, dietType: 'vegan' });
    const meat = calculateFootprint({ ...base, dietType: 'meat' });
    expect(meat.breakdown.food).toBeGreaterThan(vegan.breakdown.food);
  });

  it('renewable energy reduces energy emissions', async () => {
    const { calculateFootprint } = await import('../js/calculator.js');
    const base = {
      carKm: 50,
      flights: 0,
      publicTransport: 'weekly',
      dietType: 'vegetarian',
      foodWaste: 'medium',
      electricityBill: 3000,
      climateControl: true,
      onlineOrders: 0,
      clothes: 0,
      electronics: 0,
    };
    const noRenewable = calculateFootprint({ ...base, renewable: false });
    const withRenewable = calculateFootprint({ ...base, renewable: true });
    expect(withRenewable.breakdown.energy).toBeLessThan(noRenewable.breakdown.energy);
  });
});

// ─── Config Runtime ─────────────────────────────────────────────────

describe('Config Runtime', () => {
  it('ECO_CONFIG is frozen', async () => {
    const { ECO_CONFIG } = await import('../js/config.js');
    expect(Object.isFrozen(ECO_CONFIG)).toBe(true);
  });

  it('hasFirebaseConfig returns false without env vars', async () => {
    const { hasFirebaseConfig } = await import('../js/config.js');
    expect(hasFirebaseConfig()).toBe(false);
  });

  it('hasMapsConfig returns false without env vars', async () => {
    const { hasMapsConfig } = await import('../js/config.js');
    expect(hasMapsConfig()).toBe(false);
  });

  it('hasGeminiConfig returns true with default proxy endpoint', async () => {
    const { hasGeminiConfig } = await import('../js/config.js');
    expect(hasGeminiConfig()).toBe(true);
  });

  it('hasSearchConfig returns false without env vars', async () => {
    const { hasSearchConfig } = await import('../js/config.js');
    expect(hasSearchConfig()).toBe(false);
  });

  it('ECO_CONFIG.app has expected numeric constants', async () => {
    const { ECO_CONFIG } = await import('../js/config.js');
    expect(typeof ECO_CONFIG.app.indiaAverageKg).toBe('number');
    expect(typeof ECO_CONFIG.app.worldAverageKg).toBe('number');
    expect(typeof ECO_CONFIG.app.kgPerTreePerYear).toBe('number');
  });
});

// ─── Data Runtime ───────────────────────────────────────────────────

describe('Data Runtime', () => {
  it('CHALLENGES is array with entries', async () => {
    const { CHALLENGES } = await import('../js/data.js');
    expect(Array.isArray(CHALLENGES)).toBe(true);
    expect(CHALLENGES.length).toBeGreaterThan(0);
  });

  it('FALLBACK_TIPS is array', async () => {
    const { FALLBACK_TIPS } = await import('../js/data.js');
    expect(Array.isArray(FALLBACK_TIPS)).toBe(true);
    expect(FALLBACK_TIPS.length).toBeGreaterThan(0);
  });

  it('BADGES is array with id and threshold', async () => {
    const { BADGES } = await import('../js/data.js');
    expect(Array.isArray(BADGES)).toBe(true);
    BADGES.forEach((b) => {
      expect(typeof b.id).toBe('string');
      expect(typeof b.threshold).toBe('number');
    });
  });

  it('FEED_ARTICLES is array', async () => {
    const { FEED_ARTICLES } = await import('../js/data.js');
    expect(Array.isArray(FEED_ARTICLES)).toBe(true);
    expect(FEED_ARTICLES.length).toBeGreaterThan(0);
  });

  it('NEWS_TOPICS and TIP_CATEGORIES are string arrays', async () => {
    const { NEWS_TOPICS, TIP_CATEGORIES } = await import('../js/data.js');
    expect(Array.isArray(NEWS_TOPICS)).toBe(true);
    expect(Array.isArray(TIP_CATEGORIES)).toBe(true);
    NEWS_TOPICS.forEach((t) => expect(typeof t).toBe('string'));
    TIP_CATEGORIES.forEach((t) => expect(typeof t).toBe('string'));
  });
});

// ─── Logger Runtime ─────────────────────────────────────────────────

describe('Logger Runtime', () => {
  it('exports log functions', async () => {
    const logger = await import('../js/logger.js');
    expect(typeof logger.logInfo).toBe('function');
    expect(typeof logger.logWarn).toBe('function');
    expect(typeof logger.logError).toBe('function');
  });

  it('logWarn does not throw', async () => {
    const { logWarn } = await import('../js/logger.js');
    expect(() => logWarn('test', 'runtime check')).not.toThrow();
  });

  it('logError does not throw', async () => {
    const { logError } = await import('../js/logger.js');
    expect(() => logError('test', 'runtime check')).not.toThrow();
  });
});

// ─── Gemini Runtime ─────────────────────────────────────────────────

describe('Gemini Runtime', () => {
  it('getFallbackTips returns array of tips', async () => {
    const { getFallbackTips } = await import('../js/gemini.js');
    const tips = getFallbackTips();
    expect(Array.isArray(tips)).toBe(true);
    expect(tips.length).toBeGreaterThan(0);
    tips.forEach((tip) => {
      expect(typeof tip.id).toBe('string');
      expect(typeof tip.title).toBe('string');
      expect(typeof tip.savingKg).toBe('number');
      expect(typeof tip.category).toBe('string');
      expect(typeof tip.difficulty).toBe('string');
      expect(typeof tip.body).toBe('string');
    });
  });

  it('getPersonalizedTips is a callable function', async () => {
    const { getPersonalizedTips } = await import('../js/gemini.js');
    expect(typeof getPersonalizedTips).toBe('function');
  });
});

// ─── Emission Factors Runtime ───────────────────────────────────────

describe('Emission Factors Runtime', () => {
  it('EMISSION_FACTORS is array with 10+ entries', async () => {
    const { EMISSION_FACTORS } = await import('../js/emission-factors.js');
    expect(Array.isArray(EMISSION_FACTORS)).toBe(true);
    expect(EMISSION_FACTORS.length).toBeGreaterThan(10);
  });

  it('every factor has required fields', async () => {
    const { EMISSION_FACTORS } = await import('../js/emission-factors.js');
    EMISSION_FACTORS.forEach((f) => {
      expect(typeof f.id).toBe('string');
      expect(typeof f.category).toBe('string');
      expect(typeof f.title).toBe('string');
      expect(typeof f.estimate).toBe('string');
      expect(Array.isArray(f.keywords)).toBe(true);
    });
  });

  it('matchesEmissionFactor filters correctly', async () => {
    const { EMISSION_FACTORS, matchesEmissionFactor } = await import('../js/emission-factors.js');
    // Empty query matches everything
    const allMatch = EMISSION_FACTORS.every((f) => matchesEmissionFactor(f, ''));
    expect(allMatch).toBe(true);

    // Specific query filters results
    const carMatches = EMISSION_FACTORS.filter((f) => matchesEmissionFactor(f, 'car'));
    expect(carMatches.length).toBeGreaterThan(0);
    expect(carMatches.length).toBeLessThan(EMISSION_FACTORS.length);
  });
});
