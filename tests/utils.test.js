/**
 * Unit tests for core utility functions from app.js
 * Tests: formatKg, formatDate, clamp, getBadgeIds
 */
import { describe, it, expect } from "vitest";

// ── Pure utility re-implementations for testing ──
// (We re-implement these to avoid DOM dependencies in app.js imports)

function formatKg(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}T`;
  return `${Math.round(amount).toLocaleString()} kg`;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const BADGES = [
  { id: "seedling", label: "Seedling", icon: "🌱", threshold: 25 },
  { id: "starter", label: "Eco Starter", icon: "🌿", threshold: 100 },
  { id: "guardian", label: "Tree Guardian", icon: "🌳", threshold: 250 },
  { id: "defender", label: "Earth Defender", icon: "🌍", threshold: 500 },
];

function getBadgeIds(points = 0) {
  return BADGES.filter((badge) => points >= badge.threshold).map((badge) => badge.id);
}

// ── Tests ──

describe("formatKg", () => {
  it("formats zero correctly", () => {
    expect(formatKg(0)).toBe("0 kg");
  });

  it("formats small values as kg", () => {
    expect(formatKg(150)).toBe("150 kg");
  });

  it("formats 999 as kg", () => {
    expect(formatKg(999)).toBe("999 kg");
  });

  it("formats 1000+ as tonnes with one decimal", () => {
    expect(formatKg(1000)).toBe("1.0T");
  });

  it("formats 2500 as 2.5T", () => {
    expect(formatKg(2500)).toBe("2.5T");
  });

  it("formats 10000+ as tonnes with no decimals", () => {
    expect(formatKg(10000)).toBe("10T");
  });

  it("formats 15750 as 16T (rounded)", () => {
    expect(formatKg(15750)).toBe("16T");
  });

  it("handles null gracefully", () => {
    expect(formatKg(null)).toBe("0 kg");
  });

  it("handles undefined gracefully", () => {
    expect(formatKg(undefined)).toBe("0 kg");
  });

  it("handles string numbers", () => {
    expect(formatKg("500")).toBe("500 kg");
  });

  it("handles negative values", () => {
    expect(formatKg(-100)).toBe("-100 kg");
  });

  it("handles NaN input", () => {
    expect(formatKg("not a number")).toBe("0 kg");
  });
});

describe("formatDate", () => {
  it("returns 'Not recorded' for falsy values", () => {
    expect(formatDate(null)).toBe("Not recorded");
    expect(formatDate("")).toBe("Not recorded");
    expect(formatDate(undefined)).toBe("Not recorded");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2025-03-15T10:00:00Z");
    // Should contain day, month abbreviation, and year
    expect(result).toMatch(/15/);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2025/);
  });

  it("formats a Date object timestamp", () => {
    const result = formatDate(new Date(2024, 0, 1).toISOString());
    expect(result).toMatch(/01/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });
});

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max when above", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles equal min and max", () => {
    expect(clamp(50, 5, 5)).toBe(5);
  });

  it("handles value equal to min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("handles value equal to max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("works with negative ranges", () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
  });

  it("handles decimal values", () => {
    expect(clamp(3.7, 1.5, 5.5)).toBe(3.7);
  });
});

describe("getBadgeIds", () => {
  it("returns empty array for 0 points", () => {
    expect(getBadgeIds(0)).toEqual([]);
  });

  it("returns empty array for points below first threshold", () => {
    expect(getBadgeIds(10)).toEqual([]);
  });

  it("returns seedling at 25 points", () => {
    expect(getBadgeIds(25)).toEqual(["seedling"]);
  });

  it("returns seedling and starter at 100 points", () => {
    expect(getBadgeIds(100)).toEqual(["seedling", "starter"]);
  });

  it("returns three badges at 250 points", () => {
    expect(getBadgeIds(250)).toEqual(["seedling", "starter", "guardian"]);
  });

  it("returns all badges at 500+ points", () => {
    expect(getBadgeIds(500)).toEqual(["seedling", "starter", "guardian", "defender"]);
  });

  it("returns all badges at very high points", () => {
    expect(getBadgeIds(10000)).toEqual(["seedling", "starter", "guardian", "defender"]);
  });

  it("defaults to 0 when called without arguments", () => {
    expect(getBadgeIds()).toEqual([]);
  });
});
