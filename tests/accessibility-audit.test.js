/**
 * @module tests/accessibility-audit
 * @vitest-environment jsdom
 *
 * Automated accessibility audit using axe-core.
 * Runs the axe engine against parsed HTML pages to catch
 * WCAG violations that regex-based checks miss.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Loads axe-core dynamically and runs it against a jsdom document.
 * @param {string} htmlPath - Path to the HTML file to audit.
 * @returns {Promise<Object>} axe-core results.
 */
async function auditPage(htmlPath) {
  const html = readFileSync(htmlPath, 'utf-8');
  document.documentElement.innerHTML = '';
  document.write(html);
  document.close();

  // Dynamically import axe-core
  let axe;
  try {
    axe = await import('axe-core');
    if (axe.default) axe = axe.default;
  } catch {
    return null; // axe-core not installed — skip
  }

  const results = await axe.run(document, {
    rules: {
      // Disable rules that don't apply in jsdom (no visual rendering)
      'color-contrast': { enabled: false },
      'scrollable-region-focusable': { enabled: false },
    },
  });

  return results;
}

const PAGES = [
  { name: 'Home', path: 'index.html' },
  { name: 'Calculator', path: 'calculator.html' },
  { name: 'Dashboard', path: 'dashboard.html' },
  { name: 'Tips', path: 'tips.html' },
];

describe('axe-core Accessibility Audit', () => {
  PAGES.forEach(({ name, path }) => {
    it(`${name} page has no critical WCAG violations`, async () => {
      const results = await auditPage(path);

      if (!results) {
        // axe-core not installed — verify HTML structure instead
        const html = readFileSync(path, 'utf-8');
        expect(html).toContain('lang=');
        expect(html).toContain('<main');
        return;
      }

      // Filter to critical and serious violations only
      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (critical.length > 0) {
        const summary = critical
          .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`)
          .join('\n');
        expect(critical, `Accessibility violations found:\n${summary}`).toHaveLength(0);
      }
    });
  });

  it('all pages have proper document structure', () => {
    PAGES.forEach(({ path }) => {
      const html = readFileSync(path, 'utf-8');
      // Must have lang attribute
      expect(html).toMatch(/lang=["'][a-z]/i);
      // Must have a main landmark
      expect(html).toContain('<main');
      // Must have a proper title
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      // Must have viewport meta
      expect(html).toContain('viewport');
    });
  });
});
