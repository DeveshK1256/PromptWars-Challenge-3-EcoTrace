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

  describe('Calculation Logic (real imports)', () => {
    it('calculateFootprint returns totalKg and breakdown', async () => {
      const { calculateFootprint } = await import('../js/calculator-engine.js');
      const result = calculateFootprint({
        carKm: 100, flights: 2, publicTransport: 'weekly',
        dietType: 'vegetarian', foodWaste: 'medium',
        electricityBill: 2000, climateControl: true, renewable: false,
        onlineOrders: 5, clothes: 10, electronics: 1,
      });
      expect(result).toHaveProperty('totalKg');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('transport');
      expect(result.breakdown).toHaveProperty('food');
      expect(result.breakdown).toHaveProperty('energy');
      expect(result.breakdown).toHaveProperty('shopping');
      expect(result.totalKg).toBeGreaterThan(0);
    });

    it('public transport multiplier affects transport emissions', async () => {
      const { calculateFootprint } = await import('../js/calculator-engine.js');
      const base = { carKm: 200, flights: 2, dietType: 'vegetarian', foodWaste: 'medium', electricityBill: 2000, climateControl: false, renewable: false, onlineOrders: 5, clothes: 10, electronics: 1 };
      const none = calculateFootprint({ ...base, publicTransport: 'none' });
      const daily = calculateFootprint({ ...base, publicTransport: 'daily' });
      expect(none.breakdown.transport).toBeGreaterThan(daily.breakdown.transport);
    });

    it('diet type baselines differ correctly', async () => {
      const { calculateFootprint } = await import('../js/calculator-engine.js');
      const base = { carKm: 0, flights: 0, publicTransport: 'weekly', foodWaste: 'medium', electricityBill: 0, climateControl: false, renewable: false, onlineOrders: 0, clothes: 0, electronics: 0 };
      const vegan = calculateFootprint({ ...base, dietType: 'vegan' });
      const meat = calculateFootprint({ ...base, dietType: 'meat' });
      expect(meat.breakdown.food).toBeGreaterThan(vegan.breakdown.food);
      expect(meat.breakdown.food - vegan.breakdown.food).toBe(1000); // 1780 - 780
    });

    it('renewable energy reduces energy emissions by 35%', async () => {
      const { calculateFootprint, RENEWABLE_MULTIPLIER } = await import('../js/calculator-engine.js');
      const base = { carKm: 0, flights: 0, publicTransport: 'weekly', dietType: 'vegetarian', foodWaste: 'medium', electricityBill: 3000, climateControl: false, onlineOrders: 0, clothes: 0, electronics: 0 };
      const noRenew = calculateFootprint({ ...base, renewable: false });
      const withRenew = calculateFootprint({ ...base, renewable: true });
      expect(withRenew.breakdown.energy).toBeLessThan(noRenew.breakdown.energy);
      expect(RENEWABLE_MULTIPLIER).toBe(0.65);
    });

    it('totalKg equals sum of breakdown categories', async () => {
      const { calculateFootprint } = await import('../js/calculator-engine.js');
      const result = calculateFootprint({
        carKm: 150, flights: 3, publicTransport: 'occasional',
        dietType: 'meat', foodWaste: 'high',
        electricityBill: 4000, climateControl: true, renewable: false,
        onlineOrders: 10, clothes: 20, electronics: 3,
      });
      const sum = result.breakdown.transport + result.breakdown.food + result.breakdown.energy + result.breakdown.shopping;
      expect(result.totalKg).toBe(sum);
    });

    it('exports named constants for all magic numbers', async () => {
      const engine = await import('../js/calculator-engine.js');
      expect(engine.TRANSPORT_MULTIPLIERS).toBeDefined();
      expect(engine.DIET_BASE_EMISSIONS).toBeDefined();
      expect(engine.WASTE_ADDITIONS).toBeDefined();
      expect(engine.FLIGHT_EMISSIONS_KG).toBe(250);
      expect(engine.CAR_KG_PER_KM_WEEKLY).toBe(0.12);
    });

    it('getBreakdownPercentages returns category percentages', async () => {
      const { getBreakdownPercentages } = await import('../js/calculator-engine.js');
      const pcts = getBreakdownPercentages({ transport: 500, food: 300, energy: 150, shopping: 50 });
      expect(pcts.transport).toBe(50);
      expect(pcts.food).toBe(30);
      expect(pcts.energy).toBe(15);
      expect(pcts.shopping).toBe(5);
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
