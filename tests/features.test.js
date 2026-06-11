import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const featuresSource = readFileSync(resolve('js/features.js'), 'utf-8');

describe('Features Module', () => {
  describe('Module Structure', () => {
    it('has a @module JSDoc header', () => {
      expect(featuresSource).toMatch(/@module\s+features/);
    });

    it('exports exactly 9 feature functions', () => {
      const exports = featuresSource.match(/export function \w+/g);
      expect(exports).toHaveLength(9);
    });

    it('has auto-init on DOMContentLoaded', () => {
      expect(featuresSource).toContain('DOMContentLoaded');
    });
  });

  describe('Named Constants', () => {
    it('defines DEFAULT_FOOTPRINT_KG', () => {
      expect(featuresSource).toContain('DEFAULT_FOOTPRINT_KG');
    });

    it('defines KG_PER_TREE', () => {
      expect(featuresSource).toContain('KG_PER_TREE');
    });

    it('defines CANVAS dimensions', () => {
      expect(featuresSource).toContain('CANVAS_WIDTH');
      expect(featuresSource).toContain('CANVAS_HEIGHT');
    });

    it('defines AMBIENT_AUTO_STOP_MS', () => {
      expect(featuresSource).toContain('AMBIENT_AUTO_STOP_MS');
    });

    it('uses localStorage key constants', () => {
      expect(featuresSource).toContain('DARK_MODE_KEY');
      expect(featuresSource).toContain('PLEDGES_KEY');
      expect(featuresSource).toContain('FOOTPRINT_KEY');
    });
  });

  describe('Feature 1: Dark Mode', () => {
    it('checks for data-darkmode-toggle', () => {
      expect(featuresSource).toContain('[data-darkmode-toggle]');
    });

    it('respects prefers-color-scheme', () => {
      expect(featuresSource).toContain('prefers-color-scheme');
    });
  });

  describe('Feature 3: Time Machine', () => {
    it('has CO2 data from 1750 to 2025', () => {
      expect(featuresSource).toContain('1750, 280');
      expect(featuresSource).toContain('2025, 424');
    });

    it('interpolates between data points', () => {
      expect(featuresSource).toContain('getPPM');
    });

    it('has era labels', () => {
      expect(featuresSource).toContain('Pre-Industrial');
      expect(featuresSource).toContain('Climate Crisis');
    });
  });

  describe('Feature 5: Heatmap', () => {
    it('generates HEATMAP_DAYS cells', () => {
      expect(featuresSource).toContain('HEATMAP_DAYS');
    });

    it('tracks current and max streak', () => {
      expect(featuresSource).toContain('maxStreak');
      expect(featuresSource).toContain('currentStreak');
    });
  });

  describe('Feature 7: Ambient Sounds', () => {
    it('uses Web Audio API', () => {
      expect(featuresSource).toContain('AudioContext');
    });

    it('auto-stops after timeout', () => {
      expect(featuresSource).toContain('AMBIENT_AUTO_STOP_MS');
    });
  });

  describe('Feature 9: Footprint Comparison', () => {
    it('compares against country averages', () => {
      expect(featuresSource).toContain('India Avg');
      expect(featuresSource).toContain('World Avg');
      expect(featuresSource).toContain('USA Avg');
    });

    it('includes Paris Agreement goal', () => {
      expect(featuresSource).toContain('Paris Goal');
    });
  });
});
