/**
 * Tests for config validation functions.
 * Verifies that feature-detection helpers work correctly.
 */
import { describe, it, expect } from "vitest";
import {
  ECO_CONFIG,
  hasFirebaseConfig,
  hasMapsConfig,
  hasSearchConfig,
  hasGeminiConfig,
} from "../js/config.js";

describe("ECO_CONFIG structure", () => {
  it("has firebase section with required keys", () => {
    expect(ECO_CONFIG.firebase).toBeDefined();
    expect(typeof ECO_CONFIG.firebase.apiKey).toBe("string");
    expect(typeof ECO_CONFIG.firebase.authDomain).toBe("string");
    expect(typeof ECO_CONFIG.firebase.projectId).toBe("string");
    expect(typeof ECO_CONFIG.firebase.appId).toBe("string");
  });

  it("has google section", () => {
    expect(ECO_CONFIG.google).toBeDefined();
    expect(typeof ECO_CONFIG.google.mapsApiKey).toBe("string");
  });

  it("has gemini section with apiKey and model", () => {
    expect(ECO_CONFIG.gemini).toBeDefined();
    expect(typeof ECO_CONFIG.gemini.apiKey).toBe("string");
    expect(typeof ECO_CONFIG.gemini.model).toBe("string");
  });

  it("has app section with average values", () => {
    expect(ECO_CONFIG.app).toBeDefined();
    expect(typeof ECO_CONFIG.app.indiaAverageKg).toBe("number");
    expect(typeof ECO_CONFIG.app.worldAverageKg).toBe("number");
    expect(typeof ECO_CONFIG.app.cityAverageKg).toBe("number");
    expect(typeof ECO_CONFIG.app.kgPerTreePerYear).toBe("number");
  });

  it("app averages are positive numbers", () => {
    expect(ECO_CONFIG.app.indiaAverageKg).toBeGreaterThan(0);
    expect(ECO_CONFIG.app.worldAverageKg).toBeGreaterThan(0);
    expect(ECO_CONFIG.app.cityAverageKg).toBeGreaterThan(0);
    expect(ECO_CONFIG.app.kgPerTreePerYear).toBeGreaterThan(0);
  });

  it("world average is greater than India average", () => {
    expect(ECO_CONFIG.app.worldAverageKg).toBeGreaterThan(ECO_CONFIG.app.indiaAverageKg);
  });

  it("config is frozen (immutable)", () => {
    expect(Object.isFrozen(ECO_CONFIG)).toBe(true);
  });
});

describe("hasFirebaseConfig", () => {
  it("returns a boolean", () => {
    expect(typeof hasFirebaseConfig()).toBe("boolean");
  });

  it("returns true when all required Firebase keys are present", () => {
    // Current config has all keys filled
    expect(hasFirebaseConfig()).toBe(true);
  });
});

describe("hasMapsConfig", () => {
  it("returns a boolean", () => {
    expect(typeof hasMapsConfig()).toBe("boolean");
  });

  it("returns true when maps API key is present", () => {
    expect(hasMapsConfig()).toBe(true);
  });
});

describe("hasSearchConfig", () => {
  it("returns a boolean", () => {
    expect(typeof hasSearchConfig()).toBe("boolean");
  });

  it("returns true when customSearchCx is configured", () => {
    // Current config has customSearchCx set
    expect(hasSearchConfig()).toBe(true);
  });
});

describe("hasGeminiConfig", () => {
  it("returns a boolean", () => {
    expect(typeof hasGeminiConfig()).toBe("boolean");
  });

  it("returns true when Gemini API key is present", () => {
    expect(hasGeminiConfig()).toBe(true);
  });
});
