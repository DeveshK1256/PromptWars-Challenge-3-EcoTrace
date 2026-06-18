/**
 * @file Behavioral tests for EcoTrace core logic.
 * Tests real exported functions with actual inputs/outputs,
 * replacing source-text assertions with behavioral verification.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import real functions for behavioral testing
import {
  getLevelForPoints,
  getLevelProgress,
  getDailyMissions,
  getCompletedMissions,
  getStreakData,
  LEVELS,
  STREAK_MILESTONES,
} from '../js/gamification.js';

import { EMISSION_FACTORS, matchesEmissionFactor } from '../js/emission-factors.js';
import { CHALLENGES, BADGES } from '../js/data-challenges.js';
import { FALLBACK_TIPS, TIP_CATEGORIES } from '../js/data-tips.js';
import { FEED_ARTICLES, NEWS_TOPICS } from '../js/data-feed.js';
import { COUNTRY_EMISSIONS } from '../js/data-countries.js';
import { ECO_CONFIG, hasFirebaseConfig, hasGeminiConfig, hasMapsConfig, hasSearchConfig } from '../js/config.js';

/* ── Gamification Logic ──────────────────────────────────────────── */

describe('Gamification — Levels', () => {
  it('returns Eco Beginner for 0 points', () => {
    const level = getLevelForPoints(0);
    expect(level.id).toBe('beginner');
    expect(level.label).toBe('Eco Beginner');
    expect(level.icon).toBe('🌱');
  });

  it('returns Eco Explorer for 100 points', () => {
    expect(getLevelForPoints(100).id).toBe('explorer');
  });

  it('returns Green Champion for 300 points', () => {
    expect(getLevelForPoints(300).id).toBe('champion');
  });

  it('returns Climate Hero for 600 points', () => {
    expect(getLevelForPoints(600).id).toBe('hero');
  });

  it('returns Earth Legend for 1000+ points', () => {
    expect(getLevelForPoints(1500).id).toBe('legend');
  });

  it('handles boundary values correctly', () => {
    expect(getLevelForPoints(99).id).toBe('beginner');
    expect(getLevelForPoints(100).id).toBe('explorer');
    expect(getLevelForPoints(299).id).toBe('explorer');
    expect(getLevelForPoints(300).id).toBe('champion');
  });

  it('LEVELS are sorted by minPoints ascending', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints);
    }
  });

  it('all levels have required properties', () => {
    LEVELS.forEach((level) => {
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('icon');
      expect(level).toHaveProperty('minPoints');
      expect(level).toHaveProperty('color');
      expect(typeof level.minPoints).toBe('number');
    });
  });
});

describe('Gamification — Level Progress', () => {
  it('returns 50% progress at midpoint between beginner and explorer', () => {
    const prog = getLevelProgress(50);
    expect(prog.current.id).toBe('beginner');
    expect(prog.next.id).toBe('explorer');
    expect(prog.progress).toBeCloseTo(0.5);
  });

  it('returns 100% progress at max level', () => {
    const prog = getLevelProgress(2000);
    expect(prog.progress).toBe(1);
    expect(prog.next).toBeNull();
    expect(prog.current.id).toBe('legend');
  });

  it('returns 0% progress at level start', () => {
    const prog = getLevelProgress(0);
    expect(prog.progress).toBe(0);
    expect(prog.current.id).toBe('beginner');
  });

  it('clamps progress to 1 even for extreme values', () => {
    const prog = getLevelProgress(99999);
    expect(prog.progress).toBeLessThanOrEqual(1);
  });
});

describe('Gamification — Daily Missions', () => {
  it('returns exactly 3 missions', () => {
    const missions = getDailyMissions();
    expect(missions).toHaveLength(3);
  });

  it('each mission has required fields', () => {
    getDailyMissions().forEach((m) => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('label');
      expect(m).toHaveProperty('icon');
      expect(m).toHaveProperty('points');
      expect(m).toHaveProperty('category');
      expect(m.points).toBeGreaterThan(0);
      expect(typeof m.label).toBe('string');
    });
  });

  it('missions are deterministic for the same day', () => {
    const first = getDailyMissions().map((m) => m.id);
    const second = getDailyMissions().map((m) => m.id);
    expect(first).toEqual(second);
  });
});

describe('Gamification — Streaks', () => {
  beforeEach(() => {
    localStorage.removeItem('ecotrace.streak');
  });

  it('returns zero streak for fresh user', () => {
    const data = getStreakData();
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(0);
    expect(data.lastActive).toBe('');
  });

  it('STREAK_MILESTONES have increasing days', () => {
    for (let i = 1; i < STREAK_MILESTONES.length; i++) {
      expect(STREAK_MILESTONES[i].days).toBeGreaterThan(STREAK_MILESTONES[i - 1].days);
    }
  });

  it('milestones have bonus points', () => {
    STREAK_MILESTONES.forEach((m) => {
      expect(m.bonusPoints).toBeGreaterThan(0);
      expect(m).toHaveProperty('label');
      expect(m).toHaveProperty('icon');
    });
  });
});

describe('Gamification — Completed Missions', () => {
  beforeEach(() => {
    localStorage.removeItem('ecotrace.completedMissions');
  });

  it('returns empty set for fresh user', () => {
    const completed = getCompletedMissions();
    expect(completed.size).toBe(0);
  });
});

/* ── Emission Factors ─────────────────────────────────────────────── */

describe('Emission Factors', () => {
  it('has at least 10 factors', () => {
    expect(EMISSION_FACTORS.length).toBeGreaterThanOrEqual(10);
  });

  it('all factors have required fields', () => {
    EMISSION_FACTORS.forEach((f) => {
      expect(f).toHaveProperty('title');
      expect(f).toHaveProperty('category');
      expect(f).toHaveProperty('estimate');
      expect(typeof f.title).toBe('string');
      expect(f.title.length).toBeGreaterThan(0);
    });
  });

  it('has transport category factors', () => {
    const transport = EMISSION_FACTORS.filter((f) =>
      f.category.toLowerCase().includes('transport'),
    );
    expect(transport.length).toBeGreaterThan(0);
  });

  it('has food category factors', () => {
    const food = EMISSION_FACTORS.filter((f) =>
      f.category.toLowerCase().includes('food'),
    );
    expect(food.length).toBeGreaterThan(0);
  });

  it('has energy category factors', () => {
    const energy = EMISSION_FACTORS.filter((f) =>
      f.category.toLowerCase().includes('energy'),
    );
    expect(energy.length).toBeGreaterThan(0);
  });

  it('matchesEmissionFactor finds car-related factors', () => {
    const matches = EMISSION_FACTORS.filter((f) => matchesEmissionFactor(f, 'car'));
    expect(matches.length).toBeGreaterThan(0);
  });

  it('matchesEmissionFactor returns false for gibberish', () => {
    const factor = EMISSION_FACTORS[0];
    expect(matchesEmissionFactor(factor, 'xyzabc123')).toBe(false);
  });
});

/* ── Data Integrity ───────────────────────────────────────────────── */

describe('Challenges Data', () => {
  it('has at least 4 challenges', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(4);
  });

  it('challenges have required fields', () => {
    CHALLENGES.forEach((c) => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('title');
      expect(c).toHaveProperty('points');
      expect(c.points).toBeGreaterThan(0);
    });
  });
});

describe('Badges Data', () => {
  it('has at least 3 badges', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(3);
  });

  it('badges have required fields', () => {
    BADGES.forEach((b) => {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('label');
      expect(b).toHaveProperty('threshold');
    });
  });

  it('badges are sorted by threshold ascending', () => {
    for (let i = 1; i < BADGES.length; i++) {
      expect(BADGES[i].threshold).toBeGreaterThanOrEqual(BADGES[i - 1].threshold);
    }
  });
});

describe('Fallback Tips', () => {
  it('has tips for common categories', () => {
    const cats = ['Transport', 'Food', 'Energy', 'Shopping'];
    cats.forEach((cat) => {
      const tips = FALLBACK_TIPS.filter((t) => t.category === cat);
      expect(tips.length).toBeGreaterThan(0);
    });
  });

  it('tips have title and body', () => {
    FALLBACK_TIPS.forEach((t) => {
      expect(t).toHaveProperty('title');
      expect(t).toHaveProperty('body');
      expect(t.title.length).toBeGreaterThan(0);
    });
  });
});

describe('Feed Articles', () => {
  it('has at least 20 articles', () => {
    expect(FEED_ARTICLES.length).toBeGreaterThanOrEqual(20);
  });

  it('articles have required fields', () => {
    FEED_ARTICLES.forEach((a) => {
      expect(a).toHaveProperty('title');
      expect(a).toHaveProperty('url');
      expect(a).toHaveProperty('category');
    });
  });

  it('NEWS_TOPICS has string entries for filtering', () => {
    expect(NEWS_TOPICS.length).toBeGreaterThan(0);
    NEWS_TOPICS.forEach((t) => {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    });
  });
});

describe('Country Emissions', () => {
  it('has data for multiple years', () => {
    const years = Object.keys(COUNTRY_EMISSIONS).map(Number);
    expect(years.length).toBeGreaterThanOrEqual(1);
  });

  it('has data for major countries', () => {
    const latestYear = Math.max(...Object.keys(COUNTRY_EMISSIONS).map(Number));
    const countries = COUNTRY_EMISSIONS[latestYear].map((c) => c.country);
    expect(countries).toContain('India');
    expect(countries).toContain('China');
    expect(countries).toContain('United States');
  });

  it('emissions values are positive numbers', () => {
    const latestYear = Math.max(...Object.keys(COUNTRY_EMISSIONS).map(Number));
    COUNTRY_EMISSIONS[latestYear].forEach((c) => {
      expect(c.emissions).toBeGreaterThan(0);
    });
  });
});

/* ── Config ────────────────────────────────────────────────────────── */

describe('Config Structure', () => {
  it('has firebase section', () => {
    expect(ECO_CONFIG).toHaveProperty('firebase');
    expect(ECO_CONFIG.firebase).toHaveProperty('apiKey');
    expect(ECO_CONFIG.firebase).toHaveProperty('authDomain');
    expect(ECO_CONFIG.firebase).toHaveProperty('projectId');
  });

  it('has gemini section with proxyEndpoint', () => {
    expect(ECO_CONFIG).toHaveProperty('gemini');
    expect(ECO_CONFIG.gemini).toHaveProperty('proxyEndpoint');
    expect(ECO_CONFIG.gemini).toHaveProperty('model');
  });

  it('has google section with maps key', () => {
    expect(ECO_CONFIG).toHaveProperty('google');
    expect(ECO_CONFIG.google).toHaveProperty('mapsApiKey');
  });

  it('config check functions return booleans', () => {
    expect(typeof hasFirebaseConfig()).toBe('boolean');
    expect(typeof hasGeminiConfig()).toBe('boolean');
    expect(typeof hasMapsConfig()).toBe('boolean');
    expect(typeof hasSearchConfig()).toBe('boolean');
  });
});
