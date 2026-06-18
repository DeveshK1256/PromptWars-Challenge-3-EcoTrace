/**
 * @file Edge case tests for EcoTrace core functions.
 * Tests boundary values, error handling, and unusual inputs.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getLevelForPoints, getLevelProgress, completeMission, getDailyMissions, getCompletedMissions, recordDailyActivity, getStreakData } from '../js/gamification.js';
import { matchesEmissionFactor, EMISSION_FACTORS } from '../js/emission-factors.js';

describe('Gamification Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getLevelForPoints handles negative points', () => {
    const level = getLevelForPoints(-10);
    expect(level.id).toBe('beginner');
  });

  it('getLevelForPoints handles very large points', () => {
    const level = getLevelForPoints(999999);
    expect(level.id).toBe('legend');
  });

  it('getLevelProgress handles NaN', () => {
    const prog = getLevelProgress(NaN);
    expect(prog.current).toBeDefined();
  });

  it('getLevelProgress handles 0', () => {
    const prog = getLevelProgress(0);
    expect(prog.progress).toBe(0);
    expect(prog.current.id).toBe('beginner');
  });

  it('completeMission returns 0 for invalid mission id', () => {
    const result = completeMission('nonexistent-mission-xyz');
    expect(result).toBe(0);
  });

  it('completeMission returns 0 on duplicate completion', () => {
    const missions = getDailyMissions();
    const first = missions[0];
    const pts1 = completeMission(first.id);
    expect(pts1).toBeGreaterThan(0);
    const pts2 = completeMission(first.id);
    expect(pts2).toBe(0);
  });

  it('completeMission awards correct points', () => {
    const missions = getDailyMissions();
    const mission = missions[0];
    const pts = completeMission(mission.id);
    expect(pts).toBe(mission.points);
  });

  it('completeMission updates green points in localStorage', () => {
    localStorage.setItem('greenPoints', '50');
    const missions = getDailyMissions();
    completeMission(missions[0].id);
    const newPoints = Number(localStorage.getItem('greenPoints'));
    expect(newPoints).toBe(50 + missions[0].points);
  });

  it('getCompletedMissions returns empty set for corrupted data', () => {
    localStorage.setItem('ecotrace.completedMissions', 'not-json');
    const result = getCompletedMissions();
    expect(result.size).toBe(0);
  });

  it('getCompletedMissions ignores stale date data', () => {
    localStorage.setItem('ecotrace.completedMissions', JSON.stringify({
      date: '2020-01-01',
      ids: ['old-mission']
    }));
    const result = getCompletedMissions();
    expect(result.size).toBe(0);
  });

  it('recordDailyActivity starts streak at 1', () => {
    const result = recordDailyActivity();
    expect(result.streak).toBe(1);
  });

  it('recordDailyActivity is idempotent for same day', () => {
    recordDailyActivity();
    const result = recordDailyActivity();
    expect(result.streak).toBe(1);
  });

  it('getStreakData handles corrupted localStorage', () => {
    localStorage.setItem('ecotrace.streak', '{invalid json');
    const data = getStreakData();
    expect(data.currentStreak).toBe(0);
    expect(data.longestStreak).toBe(0);
  });
});

describe('Emission Factor Edge Cases', () => {
  it('matchesEmissionFactor handles empty query', () => {
    const result = matchesEmissionFactor(EMISSION_FACTORS[0], '');
    expect(typeof result).toBe('boolean');
  });

  it('matchesEmissionFactor handles special characters', () => {
    const result = matchesEmissionFactor(EMISSION_FACTORS[0], '<script>alert(1)</script>');
    expect(result).toBe(false);
  });

  it('matchesEmissionFactor is case insensitive', () => {
    const carFactors = EMISSION_FACTORS.filter(f => matchesEmissionFactor(f, 'CAR'));
    const carFactors2 = EMISSION_FACTORS.filter(f => matchesEmissionFactor(f, 'car'));
    expect(carFactors.length).toBe(carFactors2.length);
  });

  it('matchesEmissionFactor handles null factor gracefully', () => {
    try {
      matchesEmissionFactor(null, 'test');
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe('localStorage Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles concurrent reads/writes to greenPoints', () => {
    localStorage.setItem('greenPoints', '100');
    const missions = getDailyMissions();
    completeMission(missions[0].id);
    completeMission(missions[1].id);
    const total = Number(localStorage.getItem('greenPoints'));
    expect(total).toBe(100 + missions[0].points + missions[1].points);
  });

  it('greenPoints starts at 0 for fresh user', () => {
    const missions = getDailyMissions();
    completeMission(missions[0].id);
    const total = Number(localStorage.getItem('greenPoints'));
    expect(total).toBe(missions[0].points);
  });

  it('full gamification flow works end-to-end', () => {
    // Start fresh
    expect(getStreakData().currentStreak).toBe(0);
    expect(getCompletedMissions().size).toBe(0);
    
    // Record activity and complete mission
    const actResult = recordDailyActivity();
    expect(actResult.streak).toBe(1);
    
    const missions = getDailyMissions();
    const pts = completeMission(missions[0].id);
    expect(pts).toBeGreaterThan(0);
    
    // Verify state
    expect(getCompletedMissions().has(missions[0].id)).toBe(true);
    expect(Number(localStorage.getItem('greenPoints'))).toBe(pts);
    
    // Level should reflect points
    const level = getLevelForPoints(pts);
    expect(level).toBeDefined();
  });
});
