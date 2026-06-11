/**
 * Data integrity tests for static data exports from data.js
 * Validates structure, types, and consistency of country emissions, 
 * feed articles, badges, challenges, and news topics.
 */
import { describe, it, expect } from "vitest";
import {
  COUNTRY_EMISSIONS,
  COUNTRY_EMISSIONS_YEARS,
  FEED_ARTICLES,
  NEWS_TOPICS,
  BADGES,
  CHALLENGES,
  FALLBACK_TIPS,
  TIP_CATEGORIES,
  MAP_FALLBACK_SPOTS,
} from "../js/data.js";

// ── Country Emissions ──

describe("COUNTRY_EMISSIONS_YEARS", () => {
  it("is an array of numbers", () => {
    expect(Array.isArray(COUNTRY_EMISSIONS_YEARS)).toBe(true);
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(typeof year).toBe("number");
    });
  });

  it("includes years from 2020 to 2025", () => {
    expect(COUNTRY_EMISSIONS_YEARS).toContain(2020);
    expect(COUNTRY_EMISSIONS_YEARS).toContain(2025);
  });

  it("is sorted in ascending order", () => {
    for (let i = 1; i < COUNTRY_EMISSIONS_YEARS.length; i++) {
      expect(COUNTRY_EMISSIONS_YEARS[i]).toBeGreaterThan(COUNTRY_EMISSIONS_YEARS[i - 1]);
    }
  });

  it("has at least 5 years", () => {
    expect(COUNTRY_EMISSIONS_YEARS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("COUNTRY_EMISSIONS", () => {
  it("has data for every year in COUNTRY_EMISSIONS_YEARS", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(COUNTRY_EMISSIONS[year]).toBeDefined();
      expect(Array.isArray(COUNTRY_EMISSIONS[year])).toBe(true);
    });
  });

  it("has 15 countries per year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(COUNTRY_EMISSIONS[year].length).toBe(15);
    });
  });

  it("each entry has country, flag, and emissions fields", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      COUNTRY_EMISSIONS[year].forEach((entry) => {
        expect(typeof entry.country).toBe("string");
        expect(entry.country.length).toBeGreaterThan(0);
        expect(typeof entry.flag).toBe("string");
        expect(entry.flag.length).toBeGreaterThan(0);
        expect(typeof entry.emissions).toBe("number");
        expect(entry.emissions).toBeGreaterThan(0);
      });
    });
  });

  it("emissions are sorted in descending order per year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      const data = COUNTRY_EMISSIONS[year];
      for (let i = 1; i < data.length; i++) {
        expect(data[i].emissions).toBeLessThanOrEqual(data[i - 1].emissions);
      }
    });
  });

  it("China is the top emitter every year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(COUNTRY_EMISSIONS[year][0].country).toBe("China");
    });
  });

  it("United States is the second highest emitter every year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(COUNTRY_EMISSIONS[year][1].country).toBe("United States");
    });
  });

  it("India is the third highest emitter every year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      expect(COUNTRY_EMISSIONS[year][2].country).toBe("India");
    });
  });

  it("no country has zero or negative emissions", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      COUNTRY_EMISSIONS[year].forEach((entry) => {
        expect(entry.emissions).toBeGreaterThan(0);
      });
    });
  });

  it("emissions values are reasonable (between 100 and 15000 MT)", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      COUNTRY_EMISSIONS[year].forEach((entry) => {
        expect(entry.emissions).toBeGreaterThanOrEqual(100);
        expect(entry.emissions).toBeLessThanOrEqual(15000);
      });
    });
  });

  it("no duplicate countries within the same year", () => {
    COUNTRY_EMISSIONS_YEARS.forEach((year) => {
      const countries = COUNTRY_EMISSIONS[year].map((e) => e.country);
      const unique = new Set(countries);
      expect(unique.size).toBe(countries.length);
    });
  });
});

// ── Feed Articles ──

describe("FEED_ARTICLES", () => {
  it("is an array with at least 20 articles", () => {
    expect(Array.isArray(FEED_ARTICLES)).toBe(true);
    expect(FEED_ARTICLES.length).toBeGreaterThanOrEqual(20);
  });

  it("each article has required fields", () => {
    FEED_ARTICLES.forEach((article) => {
      expect(typeof article.id).toBe("string");
      expect(article.id.length).toBeGreaterThan(0);
      expect(typeof article.category).toBe("string");
      expect(typeof article.title).toBe("string");
      expect(article.title.length).toBeGreaterThan(0);
      expect(typeof article.source).toBe("string");
      expect(typeof article.url).toBe("string");
      expect(article.url).toMatch(/^https?:\/\//);
      expect(typeof article.summary).toBe("string");
      expect(typeof article.date).toBe("string");
    });
  });

  it("all article IDs are unique", () => {
    const ids = FEED_ARTICLES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("article categories match NEWS_TOPICS (excluding 'All')", () => {
    const validCategories = NEWS_TOPICS.filter((t) => t !== "All");
    FEED_ARTICLES.forEach((article) => {
      expect(validCategories).toContain(article.category);
    });
  });

  it("dates are valid ISO date strings", () => {
    FEED_ARTICLES.forEach((article) => {
      const parsed = new Date(article.date);
      expect(parsed.toString()).not.toBe("Invalid Date");
    });
  });

  it("covers multiple categories", () => {
    const categories = new Set(FEED_ARTICLES.map((a) => a.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  it("URLs are valid", () => {
    FEED_ARTICLES.forEach((article) => {
      expect(() => new URL(article.url)).not.toThrow();
    });
  });
});

// ── NEWS_TOPICS ──

describe("NEWS_TOPICS", () => {
  it("starts with 'All'", () => {
    expect(NEWS_TOPICS[0]).toBe("All");
  });

  it("has at least 4 topics", () => {
    expect(NEWS_TOPICS.length).toBeGreaterThanOrEqual(4);
  });

  it("contains no duplicates", () => {
    const unique = new Set(NEWS_TOPICS);
    expect(unique.size).toBe(NEWS_TOPICS.length);
  });
});

// ── Badges ──

describe("BADGES", () => {
  it("has at least 3 badges", () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(3);
  });

  it("each badge has id, label, icon, and threshold", () => {
    BADGES.forEach((badge) => {
      expect(typeof badge.id).toBe("string");
      expect(typeof badge.label).toBe("string");
      expect(typeof badge.icon).toBe("string");
      expect(typeof badge.threshold).toBe("number");
      expect(badge.threshold).toBeGreaterThan(0);
    });
  });

  it("thresholds are in ascending order", () => {
    for (let i = 1; i < BADGES.length; i++) {
      expect(BADGES[i].threshold).toBeGreaterThan(BADGES[i - 1].threshold);
    }
  });

  it("all badge IDs are unique", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Challenges ──

describe("CHALLENGES", () => {
  it("has at least 3 challenges", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(3);
  });

  it("each challenge has required fields", () => {
    CHALLENGES.forEach((challenge) => {
      expect(typeof challenge.id).toBe("string");
      expect(typeof challenge.title).toBe("string");
      expect(typeof challenge.description).toBe("string");
      expect(typeof challenge.points).toBe("number");
      expect(challenge.points).toBeGreaterThan(0);
      expect(typeof challenge.category).toBe("string");
      expect(typeof challenge.icon).toBe("string");
    });
  });

  it("all challenge IDs are unique", () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Fallback Tips ──

describe("FALLBACK_TIPS", () => {
  it("has exactly 5 tips", () => {
    expect(FALLBACK_TIPS.length).toBe(5);
  });

  it("each tip has required fields", () => {
    FALLBACK_TIPS.forEach((tip) => {
      expect(typeof tip.id).toBe("string");
      expect(typeof tip.category).toBe("string");
      expect(["Transport", "Food", "Energy", "Shopping"]).toContain(tip.category);
      expect(typeof tip.title).toBe("string");
      expect(typeof tip.savingKg).toBe("number");
      expect(tip.savingKg).toBeGreaterThan(0);
      expect(typeof tip.difficulty).toBe("string");
      expect(["Easy", "Medium", "Hard"]).toContain(tip.difficulty);
      expect(typeof tip.body).toBe("string");
    });
  });

  it("all tip IDs are unique", () => {
    const ids = FALLBACK_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Tip Categories ──

describe("TIP_CATEGORIES", () => {
  it("starts with 'All'", () => {
    expect(TIP_CATEGORIES[0]).toBe("All");
  });

  it("contains the four main categories", () => {
    expect(TIP_CATEGORIES).toContain("Transport");
    expect(TIP_CATEGORIES).toContain("Food");
    expect(TIP_CATEGORIES).toContain("Energy");
    expect(TIP_CATEGORIES).toContain("Shopping");
  });
});

// ── Map Fallback Spots ──

describe("MAP_FALLBACK_SPOTS", () => {
  it("has at least 3 spots", () => {
    expect(MAP_FALLBACK_SPOTS.length).toBeGreaterThanOrEqual(3);
  });

  it("each spot has required fields", () => {
    MAP_FALLBACK_SPOTS.forEach((spot) => {
      expect(typeof spot.id).toBe("string");
      expect(typeof spot.category).toBe("string");
      expect(typeof spot.name).toBe("string");
      expect(typeof spot.address).toBe("string");
      expect(typeof spot.latOffset).toBe("number");
      expect(typeof spot.lngOffset).toBe("number");
    });
  });
});
