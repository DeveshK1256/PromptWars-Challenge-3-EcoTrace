/**
 * Tests for HTML accessibility compliance across all pages.
 * Validates ARIA attributes, semantic HTML, skip links, CSP headers,
 * and proper document structure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

const HTML_DIR = resolve(".");
const htmlFiles = readdirSync(HTML_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => ({
    name: f,
    content: readFileSync(join(HTML_DIR, f), "utf-8"),
  }));

describe("HTML pages exist", () => {
  it("has at least 7 HTML pages", () => {
    expect(htmlFiles.length).toBeGreaterThanOrEqual(7);
  });

  it("includes core pages", () => {
    const names = htmlFiles.map((f) => f.name);
    expect(names).toContain("index.html");
    expect(names).toContain("calculator.html");
    expect(names).toContain("dashboard.html");
    expect(names).toContain("feed.html");
    expect(names).toContain("map.html");
    expect(names).toContain("profile.html");
    expect(names).toContain("tips.html");
    expect(names).toContain("challenges.html");
  });
});

describe.each(htmlFiles)("$name - Document structure", ({ name, content }) => {
  it("has <!doctype html> declaration", () => {
    expect(content.toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("has lang attribute on html element", () => {
    expect(content).toMatch(/<html[^>]*lang="[a-z]{2,}"/);
  });

  it("has charset meta tag", () => {
    expect(content).toMatch(/<meta charset="utf-8">/i);
  });

  it("has viewport meta tag", () => {
    expect(content).toMatch(/<meta name="viewport"/);
  });

  it("has a <title> tag", () => {
    expect(content).toMatch(/<title>.+<\/title>/);
  });

  it("has a <meta name='description'> tag", () => {
    expect(content).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
  });

  it("has exactly one <main> element", () => {
    const mainCount = (content.match(/<main[\s>]/g) || []).length;
    expect(mainCount).toBe(1);
  });
});

describe.each(htmlFiles)("$name - Accessibility", ({ name, content }) => {
  it("has a skip link", () => {
    expect(content).toContain("skip-link");
    expect(content).toMatch(/href="#main"/);
  });

  it("has a <header> element", () => {
    expect(content).toMatch(/<header[\s>]/);
  });

  it("has a <footer> element", () => {
    expect(content).toMatch(/<footer[\s>]/);
  });

  it("has a <nav> element with aria-label", () => {
    expect(content).toMatch(/<nav[^>]*aria-label="/);
  });

  it("uses aria-hidden on decorative icons", () => {
    expect(content).toContain('aria-hidden="true"');
  });

  it("has a favicon link", () => {
    expect(content).toMatch(/rel="icon"/);
  });
});

describe.each(htmlFiles)("$name - Security", ({ name, content }) => {
  it("has Content-Security-Policy meta tag", () => {
    expect(content).toContain("Content-Security-Policy");
  });

  it("CSP restricts default-src to self", () => {
    expect(content).toMatch(/default-src 'self'/);
  });

  it("CSP restricts object-src to none", () => {
    expect(content).toMatch(/object-src 'none'/);
  });

  it("includes upgrade-insecure-requests directive", () => {
    expect(content).toContain("upgrade-insecure-requests");
  });
});

describe.each(htmlFiles)("$name - Performance", ({ name, content }) => {
  it("has preconnect for Google Fonts", () => {
    expect(content).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
  });

  it("has modulepreload for Firebase SDK", () => {
    expect(content).toContain('rel="modulepreload" href="https://www.gstatic.com/firebasejs/');
  });

  it("uses type='module' for script tags", () => {
    expect(content).toMatch(/<script type="module"/);
  });
});
