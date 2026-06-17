/**
 * @vitest-environment jsdom
 */
/**
 * Tests for new hackathon features: simulator, equivalences, gamification,
 * forecasting, and team challenges.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Impact Equivalences', () => {
  it('calculates tree equivalences correctly', async () => {
    const { calculateEquivalences } = await import('../js/impact-equivalences.js');
    const results = calculateEquivalences(220); // 220 kg CO2
    const trees = results.find((r) => r.id === 'trees');
    expect(trees.value).toBe(10); // 220 / 22 = 10 trees
  });

  it('calculates driving equivalences correctly', async () => {
    const { calculateEquivalences } = await import('../js/impact-equivalences.js');
    const results = calculateEquivalences(210);
    const driving = results.find((r) => r.id === 'driving');
    expect(driving.value).toBe(1000); // 210 / 0.21 = 1000 km
  });

  it('handles zero CO2', async () => {
    const { calculateEquivalences } = await import('../js/impact-equivalences.js');
    const results = calculateEquivalences(0);
    results.forEach((r) => expect(r.value).toBe(0));
  });

  it('renders equivalence cards into container', async () => {
    const { renderEquivalences } = await import('../js/impact-equivalences.js');
    const container = document.createElement('div');
    renderEquivalences(container, 500);
    expect(container.querySelector('.equiv-grid')).toBeTruthy();
    expect(container.querySelectorAll('.equiv-card').length).toBeGreaterThanOrEqual(5);
  });

  it('does not render for zero or negative CO2', async () => {
    const { renderEquivalences } = await import('../js/impact-equivalences.js');
    const container = document.createElement('div');
    renderEquivalences(container, 0);
    expect(container.children.length).toBe(0);
  });
});

describe('Gamification - Levels', () => {
  it('returns correct level for 0 points', async () => {
    const { getLevelForPoints } = await import('../js/gamification.js');
    expect(getLevelForPoints(0).id).toBe('beginner');
  });

  it('returns correct level for 150 points', async () => {
    const { getLevelForPoints } = await import('../js/gamification.js');
    expect(getLevelForPoints(150).id).toBe('explorer');
  });

  it('returns highest level for 1500 points', async () => {
    const { getLevelForPoints } = await import('../js/gamification.js');
    expect(getLevelForPoints(1500).id).toBe('legend');
  });

  it('calculates level progress correctly', async () => {
    const { getLevelProgress } = await import('../js/gamification.js');
    const { current, next, progress } = getLevelProgress(200);
    expect(current.id).toBe('explorer');
    expect(next.id).toBe('champion');
    expect(progress).toBeCloseTo(0.5, 1); // 200-100 / 300-100 = 0.5
  });

  it('returns full progress at max level', async () => {
    const { getLevelProgress } = await import('../js/gamification.js');
    const { next, progress } = getLevelProgress(2000);
    expect(next).toBeNull();
    expect(progress).toBe(1);
  });
});

describe('Gamification - Daily Missions', () => {
  it('returns exactly 3 daily missions', async () => {
    const { getDailyMissions } = await import('../js/gamification.js');
    const missions = getDailyMissions();
    expect(missions).toHaveLength(3);
  });

  it('returns same missions for same day', async () => {
    const { getDailyMissions } = await import('../js/gamification.js');
    const first = getDailyMissions();
    const second = getDailyMissions();
    expect(first.map((m) => m.id)).toEqual(second.map((m) => m.id));
  });

  it('marks mission as completed and awards points', async () => {
    const { getDailyMissions, completeMission } = await import('../js/gamification.js');
    const missions = getDailyMissions();
    const awarded = completeMission(missions[0].id);
    expect(awarded).toBe(missions[0].points);
    expect(Number(localStorage.getItem('greenPoints'))).toBe(missions[0].points);
  });

  it('does not double-award for same mission', async () => {
    const { getDailyMissions, completeMission } = await import('../js/gamification.js');
    const missions = getDailyMissions();
    completeMission(missions[0].id);
    const second = completeMission(missions[0].id);
    expect(second).toBe(0);
  });
});

describe('Gamification - Streaks', () => {
  it('starts with zero streak', async () => {
    const { getStreakData } = await import('../js/gamification.js');
    expect(getStreakData().currentStreak).toBe(0);
  });

  it('records daily activity', async () => {
    const { recordDailyActivity } = await import('../js/gamification.js');
    const { streak } = recordDailyActivity();
    expect(streak).toBe(1);
  });

  it('does not double-count same day', async () => {
    const { recordDailyActivity } = await import('../js/gamification.js');
    recordDailyActivity();
    const { streak } = recordDailyActivity();
    expect(streak).toBe(1);
  });
});

describe('Team Challenges', () => {
  it('initializes with default teams', async () => {
    const { getTeams } = await import('../js/team-challenges.js');
    const teams = getTeams();
    expect(teams.length).toBeGreaterThanOrEqual(4);
  });

  it('joins a team', async () => {
    const { getTeams, joinTeam, getUserTeam } = await import('../js/team-challenges.js');
    const teams = getTeams();
    joinTeam(teams[0].id);
    expect(getUserTeam()).toBe(teams[0].id);
  });

  it('creates a new team', async () => {
    const { createTeam, getTeams, getUserTeam } = await import('../js/team-challenges.js');
    const team = createTeam('Test Team', '🧪');
    expect(team.name).toBe('Test Team');
    expect(getUserTeam()).toBe(team.id);
    expect(getTeams().some((t) => t.id === team.id)).toBe(true);
  });

  it('contributes CO2 savings to team', async () => {
    const { getTeams, joinTeam, contributeToTeam } = await import('../js/team-challenges.js');
    const teams = getTeams();
    const initialCo2 = teams[0].co2Saved;
    joinTeam(teams[0].id);
    contributeToTeam(100);
    const updated = getTeams();
    expect(updated[0].co2Saved).toBe(initialCo2 + 100);
  });

  it('renders team leaderboard', async () => {
    const { renderTeamLeaderboard } = await import('../js/team-challenges.js');
    const container = document.createElement('div');
    renderTeamLeaderboard(container);
    expect(container.querySelector('.team-table')).toBeTruthy();
    expect(container.querySelectorAll('tr').length).toBeGreaterThanOrEqual(4);
  });
});

describe('Simulator Actions', () => {
  it('exports valid simulator actions', async () => {
    const { SIMULATOR_ACTIONS } = await import('../js/simulator.js');
    expect(SIMULATOR_ACTIONS.length).toBeGreaterThanOrEqual(5);
    SIMULATOR_ACTIONS.forEach((action) => {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.savingPerUnit).toBeGreaterThan(0);
    });
  });
});

describe('Forecasting', () => {
  it('returns default forecast when no footprints', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('no network'));
    global.fetch = mockFetch;

    const { getForecast } = await import('../js/forecasting.js');
    const forecast = await getForecast([]);
    expect(forecast.projectedAnnualKg).toBeGreaterThan(0);
    expect(forecast.monthlyProjection).toHaveLength(12);
    expect(forecast.topRecommendation).toBeTruthy();
  });

  it('renders forecast panel', async () => {
    const { renderForecast } = await import('../js/forecasting.js');
    const container = document.createElement('div');
    renderForecast(container, {
      projectedAnnualKg: 3500,
      trendDirection: 'decreasing',
      trendPercentage: 12,
      highestCategory: 'Transport',
      topRecommendation: 'Use public transit 3x/week',
      estimatedSavingKg: 500,
      monthlyProjection: Array.from({ length: 12 }, () => 292),
      confidence: 'high',
    });
    expect(container.querySelector('.forecast-grid')).toBeTruthy();
    expect(container.querySelector('.forecast-chart')).toBeTruthy();
  });
});
