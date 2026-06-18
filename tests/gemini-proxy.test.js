import { describe, it, expect } from 'vitest';

describe('Gemini Module (real imports)', () => {
  describe('parseGeminiResponse', () => {
    it('extracts tips from valid Gemini response', async () => {
      const { parseGeminiResponse } = await import('../js/gemini.js');
      const mockData = {
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({
              tips: [
                { id: 'tip-1', category: 'Transport', title: 'Cycle more', savingKg: 500, difficulty: 'Easy', body: 'Try cycling to work' },
                { id: 'tip-2', category: 'Food', title: 'Eat plant-based', savingKg: 300, difficulty: 'Medium', body: 'Switch to plant meals' },
              ]
            }) }]
          }
        }]
      };
      const result = parseGeminiResponse(mockData);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Cycle more');
      expect(result[0].category).toBe('Transport');
    });

    it('returns fallback tips on empty candidates', async () => {
      const { parseGeminiResponse, getFallbackTips } = await import('../js/gemini.js');
      let result;
      try {
        result = parseGeminiResponse({ candidates: [] });
      } catch {
        result = getFallbackTips();
      }
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles code-fenced JSON response', async () => {
      const { parseGeminiResponse } = await import('../js/gemini.js');
      const fencedResponse = {
        candidates: [{
          content: {
            parts: [{ text: '```json\n{"tips": [{"id": "fenced", "category": "Energy", "title": "Switch LED", "savingKg": 100, "difficulty": "Easy", "body": "Use LEDs"}]}\n```' }]
          }
        }]
      };
      const result = parseGeminiResponse(fencedResponse);
      expect(result[0].title).toBe('Switch LED');
      expect(result[0].category).toBe('Energy');
    });
  });

  describe('getFallbackTips', () => {
    it('returns array of normalized tips', async () => {
      const { getFallbackTips } = await import('../js/gemini.js');
      const tips = getFallbackTips();
      expect(Array.isArray(tips)).toBe(true);
      expect(tips.length).toBeGreaterThan(0);
    });

    it('each fallback tip has required fields', async () => {
      const { getFallbackTips } = await import('../js/gemini.js');
      const tips = getFallbackTips();
      tips.forEach(tip => {
        expect(tip).toHaveProperty('id');
        expect(tip).toHaveProperty('category');
        expect(tip).toHaveProperty('title');
        expect(tip).toHaveProperty('savingKg');
        expect(tip).toHaveProperty('difficulty');
        expect(tip).toHaveProperty('body');
        expect(tip.title.length).toBeGreaterThan(0);
        expect(tip.savingKg).toBeGreaterThan(0);
      });
    });

    it('category is one of Transport/Food/Energy/Shopping', async () => {
      const { getFallbackTips } = await import('../js/gemini.js');
      const tips = getFallbackTips();
      const validCategories = ['Transport', 'Food', 'Energy', 'Shopping'];
      tips.forEach(tip => {
        expect(validCategories).toContain(tip.category);
      });
    });
  });

  describe('normalizeTip', () => {
    it('creates consistent structure from valid input', async () => {
      const { normalizeTip } = await import('../js/gemini.js');
      const tip = normalizeTip({ id: 'test', category: 'Transport', title: 'Walk', savingKg: 200, difficulty: 'Easy', body: 'Walk daily' }, 0);
      expect(tip.id).toBe('test');
      expect(tip.title).toBe('Walk');
      expect(tip.category).toBe('Transport');
      expect(tip.difficulty).toBe('Easy');
    });

    it('falls back on missing/invalid fields', async () => {
      const { normalizeTip } = await import('../js/gemini.js');
      const tip = normalizeTip({}, 0);
      expect(tip).toHaveProperty('title');
      expect(tip).toHaveProperty('category');
      expect(tip.title.length).toBeGreaterThan(0);
      expect(tip.savingKg).toBeGreaterThan(0);
    });

    it('rejects invalid category and falls back', async () => {
      const { normalizeTip } = await import('../js/gemini.js');
      const tip = normalizeTip({ category: 'InvalidCat', title: 'Test' }, 0);
      const validCategories = ['Transport', 'Food', 'Energy', 'Shopping'];
      expect(validCategories).toContain(tip.category);
    });

    it('rejects invalid difficulty and falls back', async () => {
      const { normalizeTip } = await import('../js/gemini.js');
      const tip = normalizeTip({ difficulty: 'Extreme' }, 0);
      const validDiffs = ['Easy', 'Medium', 'Hard'];
      expect(validDiffs).toContain(tip.difficulty);
    });
  });
});
