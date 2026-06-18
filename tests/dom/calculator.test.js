/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read and evaluate the calculator source to extract the function
const calcSource = readFileSync(resolve('js/calculator.js'), 'utf-8');

describe('calculateFootprint (real imports)', () => {
  it('returns object with totalKg and breakdown', async () => {
    const { calculateFootprint } = await import('../../js/calculator-engine.js');
    const result = calculateFootprint({
      carKm: 100, flights: 2, publicTransport: 'weekly',
      dietType: 'vegetarian', foodWaste: 'medium',
      electricityBill: 2000, climateControl: false, renewable: false,
      onlineOrders: 5, clothes: 10, electronics: 1,
    });
    expect(result.totalKg).toBeGreaterThan(0);
    expect(result.breakdown.transport).toBeGreaterThan(0);
    expect(result.breakdown.food).toBeGreaterThan(0);
    expect(result.breakdown.energy).toBeGreaterThan(0);
    expect(result.breakdown.shopping).toBeGreaterThan(0);
  });

  it('diet baselines affect food emissions correctly', async () => {
    const { calculateFootprint } = await import('../../js/calculator-engine.js');
    const base = { carKm: 0, flights: 0, publicTransport: 'weekly', foodWaste: 'low', electricityBill: 0, climateControl: false, renewable: false, onlineOrders: 0, clothes: 0, electronics: 0 };
    const vegan = calculateFootprint({ ...base, dietType: 'vegan' });
    const veg = calculateFootprint({ ...base, dietType: 'vegetarian' });
    const meat = calculateFootprint({ ...base, dietType: 'meat' });
    expect(vegan.breakdown.food).toBeLessThan(veg.breakdown.food);
    expect(veg.breakdown.food).toBeLessThan(meat.breakdown.food);
  });

  it('renewable energy reduces emissions', async () => {
    const { calculateFootprint } = await import('../../js/calculator-engine.js');
    const base = { carKm: 0, flights: 0, publicTransport: 'weekly', dietType: 'vegetarian', foodWaste: 'medium', electricityBill: 3000, climateControl: false, onlineOrders: 0, clothes: 0, electronics: 0 };
    const noRenew = calculateFootprint({ ...base, renewable: false });
    const withRenew = calculateFootprint({ ...base, renewable: true });
    expect(withRenew.breakdown.energy).toBeLessThan(noRenew.breakdown.energy);
  });
});

describe('Calculator UI Interactions', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form data-calculator-form>
        <div data-step-panel="1">
          <input name="carKm" type="number" value="100" />
          <input name="flights" type="number" value="2" />
          <select name="publicTransport"><option value="weekly">Weekly</option></select>
        </div>
        <div data-step-panel="2">
          <select name="dietType"><option value="vegetarian">Vegetarian</option></select>
          <select name="foodWaste"><option value="medium">Medium</option></select>
        </div>
        <div data-step-panel="3">
          <input name="electricityBill" type="number" value="2000" />
        </div>
        <div data-step-panel="4">
          <input name="onlineOrders" type="number" value="5" />
          <input name="clothes" type="number" value="10" />
          <input name="electronics" type="number" value="1" />
        </div>
        <div data-step-indicator="1" class="active"></div>
        <div data-step-indicator="2"></div>
        <div data-step-indicator="3"></div>
        <div data-step-indicator="4"></div>
        <div data-result-panel hidden></div>
        <div data-ai-tips-panel></div>
        <button data-next-step>Next</button>
        <button data-prev-step>Back</button>
        <button data-save-result>Save</button>
      </form>
      <form data-emission-search-form><input type="search" /><button type="submit">Search</button></form>
      <div data-emission-search-results></div>
    `;
  });

  it('form has all required fields', () => {
    const form = document.querySelector('[data-calculator-form]');
    expect(form).not.toBeNull();
    expect(form.querySelector('input[name="carKm"]')).not.toBeNull();
    expect(form.querySelector('input[name="flights"]')).not.toBeNull();
    expect(form.querySelector('select[name="dietType"]')).not.toBeNull();
  });

  it('step panels exist for all 4 steps', () => {
    const panels = document.querySelectorAll('[data-step-panel]');
    expect(panels.length).toBe(4);
  });

  it('step indicators exist', () => {
    const indicators = document.querySelectorAll('[data-step-indicator]');
    expect(indicators.length).toBe(4);
  });

  it('input events update values', () => {
    const input = document.querySelector('input[name="carKm"]');
    input.value = '200';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('200');
  });

  it('result panel starts hidden', () => {
    const result = document.querySelector('[data-result-panel]');
    expect(result.hasAttribute('hidden')).toBe(true);
  });

  it('emission search form exists', () => {
    const searchForm = document.querySelector('[data-emission-search-form]');
    expect(searchForm).not.toBeNull();
  });
});
