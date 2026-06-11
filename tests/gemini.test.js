/**
 * Tests for Gemini AI response parsing and tip normalization.
 * Verifies the parsing logic handles valid, malformed, and edge-case responses.
 */
import { describe, it, expect } from "vitest";

// ── Re-implement parsing logic from gemini.js for testability ──

const FALLBACK_TIPS = [
  { id: "tip-transit-pass", category: "Transport", title: "Replace two short car trips with public transport", savingKg: 72, difficulty: "Easy", body: "Pick two predictable weekly trips under 8 km." },
  { id: "tip-meal-swap", category: "Food", title: "Make three dinners plant-forward", savingKg: 95, difficulty: "Medium", body: "Swap red meat meals for dal, chana, paneer." },
  { id: "tip-ac-timer", category: "Energy", title: "Raise AC temperature by 1-2°C", savingKg: 120, difficulty: "Easy", body: "Set AC to 25-26°C, use sleep mode." },
  { id: "tip-buy-list", category: "Shopping", title: "Use a 48-hour buying pause", savingKg: 64, difficulty: "Easy", body: "Add non-essential online orders to a list." },
  { id: "tip-repair", category: "Shopping", title: "Repair one item before replacing it", savingKg: 180, difficulty: "Medium", body: "Try repair, resale, or refurbished options." },
];

function normalizeTip(tip, index) {
  const fallback = FALLBACK_TIPS[index % FALLBACK_TIPS.length];
  const category = ["Transport", "Food", "Energy", "Shopping"].includes(tip?.category) ? tip.category : fallback.category;
  const difficulty = ["Easy", "Medium", "Hard"].includes(tip?.difficulty) ? tip.difficulty : fallback.difficulty;
  return {
    id: String(tip?.id || fallback.id || `ai-tip-${index}`).slice(0, 80),
    category,
    title: String(tip?.title || fallback.title).slice(0, 100),
    savingKg: Math.max(5, Math.round(Number(tip?.savingKg || fallback.savingKg || 25))),
    difficulty,
    body: String(tip?.body || fallback.body).slice(0, 240),
  };
}

function parseGeminiResponse(data) {
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed?.tips) ? parsed.tips.map(normalizeTip).slice(0, 5) : FALLBACK_TIPS;
}

// ── Tests ──

describe("normalizeTip", () => {
  it("returns a valid tip from a well-formed input", () => {
    const input = {
      id: "test-tip",
      category: "Food",
      title: "Eat more vegetables",
      savingKg: 50,
      difficulty: "Easy",
      body: "Increase vegetable intake to reduce meat consumption.",
    };
    const result = normalizeTip(input, 0);
    expect(result.id).toBe("test-tip");
    expect(result.category).toBe("Food");
    expect(result.title).toBe("Eat more vegetables");
    expect(result.savingKg).toBe(50);
    expect(result.difficulty).toBe("Easy");
  });

  it("falls back to default category for invalid category", () => {
    const result = normalizeTip({ category: "InvalidCategory" }, 0);
    expect(["Transport", "Food", "Energy", "Shopping"]).toContain(result.category);
  });

  it("falls back to default difficulty for invalid difficulty", () => {
    const result = normalizeTip({ difficulty: "Super Hard" }, 0);
    expect(["Easy", "Medium", "Hard"]).toContain(result.difficulty);
  });

  it("enforces minimum savingKg of 5", () => {
    const result = normalizeTip({ savingKg: 1 }, 0);
    expect(result.savingKg).toBeGreaterThanOrEqual(5);
  });

  it("handles null input gracefully", () => {
    const result = normalizeTip(null, 0);
    expect(result.id).toBe(FALLBACK_TIPS[0].id);
    expect(result.category).toBe(FALLBACK_TIPS[0].category);
  });

  it("handles undefined input gracefully", () => {
    const result = normalizeTip(undefined, 2);
    expect(result.id).toBe(FALLBACK_TIPS[2].id);
  });

  it("truncates long title to 100 characters", () => {
    const longTitle = "A".repeat(200);
    const result = normalizeTip({ title: longTitle }, 0);
    expect(result.title.length).toBeLessThanOrEqual(100);
  });

  it("truncates long body to 240 characters", () => {
    const longBody = "B".repeat(300);
    const result = normalizeTip({ body: longBody }, 0);
    expect(result.body.length).toBeLessThanOrEqual(240);
  });

  it("truncates long id to 80 characters", () => {
    const longId = "c".repeat(100);
    const result = normalizeTip({ id: longId }, 0);
    expect(result.id.length).toBeLessThanOrEqual(80);
  });

  it("rounds savingKg to integer", () => {
    const result = normalizeTip({ savingKg: 33.7 }, 0);
    expect(Number.isInteger(result.savingKg)).toBe(true);
    expect(result.savingKg).toBe(34);
  });

  it("wraps index around fallback tips array", () => {
    const result = normalizeTip(null, 7); // index 7 % 5 = 2
    expect(result.id).toBe(FALLBACK_TIPS[2].id);
  });
});

describe("parseGeminiResponse", () => {
  it("parses a valid Gemini response", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  tips: [
                    { id: "ai-1", category: "Transport", title: "Walk more", savingKg: 30, difficulty: "Easy", body: "Walk instead of drive." },
                    { id: "ai-2", category: "Food", title: "Eat local", savingKg: 40, difficulty: "Medium", body: "Buy local produce." },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };
    const tips = parseGeminiResponse(response);
    expect(tips.length).toBe(2);
    expect(tips[0].id).toBe("ai-1");
    expect(tips[1].category).toBe("Food");
  });

  it("handles JSON wrapped in markdown code block", () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '```json\n{"tips": [{"id": "md-1", "category": "Energy", "title": "Turn off lights", "savingKg": 20, "difficulty": "Easy", "body": "Switch off when leaving."}]}\n```',
              },
            ],
          },
        },
      ],
    };
    const tips = parseGeminiResponse(response);
    expect(tips.length).toBe(1);
    expect(tips[0].id).toBe("md-1");
  });

  it("limits to maximum 5 tips", () => {
    const manyTips = Array.from({ length: 10 }, (_, i) => ({
      id: `tip-${i}`,
      category: "Food",
      title: `Tip ${i}`,
      savingKg: 10 + i,
      difficulty: "Easy",
      body: `Body ${i}`,
    }));
    const response = {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ tips: manyTips }) }] } }],
    };
    const tips = parseGeminiResponse(response);
    expect(tips.length).toBe(5);
  });

  it("returns fallback for response without tips array", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ something: "else" }) }] } }],
    };
    const tips = parseGeminiResponse(response);
    expect(tips).toEqual(FALLBACK_TIPS);
  });

  it("throws for completely invalid JSON", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "not json at all" }] } }],
    };
    expect(() => parseGeminiResponse(response)).toThrow();
  });

  it("handles empty candidates", () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow();
  });

  it("handles null response", () => {
    expect(() => parseGeminiResponse(null)).toThrow();
  });
});
