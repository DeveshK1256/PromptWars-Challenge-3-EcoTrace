import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const calculatorSource = readFileSync(resolve('js/calculator.js'), 'utf-8');
const emissionFactorsSource = existsSync(resolve('js/emission-factors.js'))
  ? readFileSync(resolve('js/emission-factors.js'), 'utf-8')
  : calculatorSource;
const combinedSource = calculatorSource + '\n' + emissionFactorsSource;
describe('Calculator Module', () => {
  describe('Code Quality', () => {
    it('has a @module JSDoc header', () => {
      expect(calculatorSource).toMatch(/@module\s+calculator/);
    });

    it('has JSDoc for EMISSION_FACTORS', () => {
      expect(combinedSource).toMatch(/@type.*Array/);
    });
  });

  describe('Emission Factors', () => {
    it('defines at least 10 emission factors', () => {
      const matches = combinedSource.match(/id:\s*"/g);
      expect(matches.length).toBeGreaterThanOrEqual(10);
    });

    it('covers all 4 categories plus Comparison', () => {
      expect(combinedSource).toContain('category: "Transport"');
      expect(combinedSource).toContain('category: "Food"');
      expect(combinedSource).toContain('category: "Energy"');
      expect(combinedSource).toContain('category: "Shopping"');
      expect(combinedSource).toContain('category: "Comparison"');
    });

    it('each factor has required fields', () => {
      const factorBlocks = combinedSource.match(/\{\s*id:\s*"[^"]+"/g);
      expect(factorBlocks.length).toBeGreaterThanOrEqual(10);
      // Check required field patterns exist
      expect(combinedSource).toContain('keywords:');
      expect(combinedSource).toContain('estimate:');
      expect(combinedSource).toContain('detail:');
    });

    it('has India and world average comparison entries', () => {
      expect(combinedSource).toContain('"india-average"');
      expect(combinedSource).toContain('"world-average"');
    });
  });

  describe('Calculation Logic', () => {
    it('exports calculateFootprint function', () => {
      expect(calculatorSource).toContain('export function calculateFootprint');
    });

    it('applies public transport multiplier', () => {
      expect(calculatorSource).toContain('publicTransportMultiplier');
      expect(calculatorSource).toContain('none: 1.12');
      expect(calculatorSource).toContain('daily: 0.68');
    });

    it('has diet type baselines', () => {
      expect(calculatorSource).toContain('vegan: 780');
      expect(calculatorSource).toContain('vegetarian: 1120');
      expect(calculatorSource).toContain('meat: 1780');
    });

    it('includes renewable energy multiplier', () => {
      expect(calculatorSource).toContain('renewable');
      expect(calculatorSource).toContain('0.65');
    });

    it('returns breakdown with 4 categories', () => {
      expect(calculatorSource).toContain('transport: Math.round');
      expect(calculatorSource).toContain('food: Math.round');
      expect(calculatorSource).toContain('energy: Math.round');
      expect(calculatorSource).toContain('shopping: Math.round');
    });

    it('computes totalKg from breakdown', () => {
      expect(calculatorSource).toContain('totalKg:');
      expect(calculatorSource).toContain('.reduce(');
    });
  });

  describe('UI Integration', () => {
    it('handles step navigation', () => {
      expect(calculatorSource).toContain('data-step-panel');
      expect(calculatorSource).toContain('data-next-step');
      expect(calculatorSource).toContain('data-prev-step');
    });

    it('renders AI tips', () => {
      expect(calculatorSource).toContain('renderAiTips');
      expect(calculatorSource).toContain('getPersonalizedTips');
    });

    it('supports save result with authentication', () => {
      expect(calculatorSource).toContain('data-save-result');
      expect(calculatorSource).toContain('saveFootprint');
    });

    it('has emission factor search', () => {
      expect(calculatorSource).toContain('matchesEmissionFactor');
      expect(calculatorSource).toContain('renderEmissionSearchResults');
    });
  });
});
