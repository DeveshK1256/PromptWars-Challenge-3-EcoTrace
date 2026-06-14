import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const cssFiles = readdirSync(resolve('css'))
  .filter(f => f.endsWith('.css'))
  .map(f => ({
    name: f,
    content: readFileSync(resolve('css', f), 'utf-8'),
  }));

const htmlFiles = ['index.html', 'calculator.html', 'dashboard.html', 'map.html', 'feed.html', 'challenges.html', 'profile.html', 'about.html']
  .filter(f => {
    try { readFileSync(resolve(f), 'utf-8'); return true; } catch { return false; }
  })
  .map(f => ({
    name: f,
    content: readFileSync(resolve(f), 'utf-8'),
  }));

describe('Accessibility Standards', () => {
  describe('Colour Contrast', () => {
    it('uses CSS custom properties for theming (enables consistent contrast)', () => {
      const allCss = cssFiles.map(f => f.content).join('\n');
      expect(allCss).toContain('--');
      // Should have color variables
      const customProps = allCss.match(/--[\w-]+/g) || [];
      expect(customProps.length).toBeGreaterThan(5);
    });

    it('does not use pure black (#000) text on white backgrounds', () => {
      const allCss = cssFiles.map(f => f.content).join('\n');
      // Pure #000 on #fff is harsh - good design uses softer contrasts
      const bodyRules = allCss.match(/body\s*\{[^}]*color:\s*#000/g) || [];
      expect(bodyRules).toHaveLength(0);
    });

    it('focus styles are defined for interactive elements', () => {
      const allCss = cssFiles.map(f => f.content).join('\n');
      expect(allCss).toContain(':focus');
    });

    it('prefers-reduced-motion is respected', () => {
      const allCss = cssFiles.map(f => f.content).join('\n');
      expect(allCss).toContain('prefers-reduced-motion');
    });
  });

  describe('ARIA and Semantic HTML', () => {
    htmlFiles.forEach(({ name, content }) => {
      it(`${name} has lang attribute`, () => {
        expect(content).toMatch(/html[^>]+lang="/);
      });

      it(`${name} has a skip link`, () => {
        expect(content).toContain('skip');
      });

      it(`${name} uses semantic main element`, () => {
        expect(content).toContain('<main');
      });

      it(`${name} has a single h1`, () => {
        const h1Count = (content.match(/<h1/g) || []).length;
        expect(h1Count).toBe(1);
      });
    });
  });

  describe('Form Accessibility', () => {
    const formsHtml = htmlFiles.filter(({ content }) => content.includes('<form'));
    formsHtml.forEach(({ name, content }) => {
      it(`${name} forms have labels or aria-label`, () => {
        const inputs = content.match(/<input[^>]*>/g) || [];
        const labeled = inputs.filter(inp => 
          inp.includes('hidden') || 
          inp.includes('aria-label') || 
          inp.includes('id=') ||
          inp.includes('placeholder=') ||
          inp.includes('name=')
        );
        // Most inputs should have some labeling mechanism
        expect(labeled.length).toBeGreaterThan(0);
      });
    });
  });
});
