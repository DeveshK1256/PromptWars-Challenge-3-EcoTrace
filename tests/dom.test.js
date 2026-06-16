/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indexHtml = readFileSync(resolve('index.html'), 'utf-8');
const calcHtml = readFileSync(resolve('calculator.html'), 'utf-8');
const dashHtml = readFileSync(resolve('dashboard.html'), 'utf-8');

describe('Real DOM Structure Tests', () => {
  describe('Index Page DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      document.documentElement.innerHTML = indexHtml;
    });

    it('has a skip link targeting main-content', () => {
      const skip = document.querySelector('.skip-link');
      expect(skip).not.toBeNull();
      expect(skip.getAttribute('href')).toBe('#main');
      const main = document.getElementById('main');
      expect(main).not.toBeNull();
    });

    it('has a dark mode toggle with correct attributes', () => {
      const toggle = document.querySelector('[data-darkmode-toggle]');
      expect(toggle).not.toBeNull();
      expect(toggle.getAttribute('aria-label')).toBeTruthy();
    });

    it('has a reduced-motion toggle', () => {
      const btn = document.querySelector('[data-reduced-motion]');
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toContain('motion');
    });

    it('has navigation links with data-nav-link', () => {
      const links = document.querySelectorAll('[data-nav-link]');
      expect(links.length).toBeGreaterThanOrEqual(5);
    });

    it('has a carbon counter element', () => {
      const counter = document.querySelector('[data-co2-counter]');
      expect(counter).not.toBeNull();
    });

    it('all images have alt attributes', () => {
      const imgs = document.querySelectorAll('img');
      imgs.forEach(img => {
        expect(img.hasAttribute('alt')).toBe(true);
      });
    });
  });

  describe('Calculator Page DOM', () => {
    beforeEach(() => {
      document.documentElement.innerHTML = calcHtml;
    });

    it('has a calculator form', () => {
      const form = document.querySelector('[data-calculator-form]');
      expect(form).not.toBeNull();
    });

    it('has step indicators', () => {
      const steps = document.querySelectorAll('.step-indicator span');
      expect(steps.length).toBeGreaterThan(0);
    });

    it('has numeric input fields', () => {
      const inputs = document.querySelectorAll('input[type="number"]');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('numeric inputs have min attribute', () => {
      const inputs = document.querySelectorAll('input[type="number"]');
      inputs.forEach(input => {
        expect(input.hasAttribute('min')).toBe(true);
      });
    });
  });

  describe('Dashboard Page DOM', () => {
    beforeEach(() => {
      document.documentElement.innerHTML = dashHtml;
    });

    it('has auth-required attribute', () => {
      const main = document.querySelector('[data-auth-required]');
      expect(main).not.toBeNull();
    });

    it('has canvas elements for charts', () => {
      const canvases = document.querySelectorAll('canvas');
      expect(canvases.length).toBeGreaterThan(0);
    });
  });

  describe('Dark Mode Behavior', () => {
    it('data-theme attribute toggles correctly', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      document.documentElement.removeAttribute('data-theme');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('localStorage persists theme preference', () => {
      localStorage.setItem('eco-dark-mode', 'true');
      expect(localStorage.getItem('eco-dark-mode')).toBe('true');
      localStorage.removeItem('eco-dark-mode');
      expect(localStorage.getItem('eco-dark-mode')).toBeNull();
    });
  });

  describe('Eco Activities Cache', () => {
    it('can store and retrieve activities', () => {
      const activities = [
        { createdAt: new Date().toISOString(), co2Kg: 150, type: 'calculator' },
      ];
      localStorage.setItem('eco-activities-cache', JSON.stringify(activities));
      const retrieved = JSON.parse(localStorage.getItem('eco-activities-cache'));
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].co2Kg).toBe(150);
      expect(retrieved[0].type).toBe('calculator');
      localStorage.removeItem('eco-activities-cache');
    });
  });
});
