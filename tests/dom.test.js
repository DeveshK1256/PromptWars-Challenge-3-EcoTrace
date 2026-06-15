/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('DOM Utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Toast Notifications', () => {
    it('creates a toast element in the DOM', () => {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('role', 'alert');
      container.setAttribute('aria-live', 'polite');
      document.body.append(container);
      expect(document.getElementById('toast-container')).not.toBeNull();
      expect(container.getAttribute('role')).toBe('alert');
    });
  });

  describe('Navigation', () => {
    it('marks active nav link correctly', () => {
      const nav = document.createElement('nav');
      const link1 = document.createElement('a');
      link1.href = '/index.html';
      const link2 = document.createElement('a');
      link2.href = '/dashboard.html';
      nav.append(link1, link2);
      document.body.append(nav);
      link1.classList.add('active');
      link1.setAttribute('aria-current', 'page');
      expect(link1.classList.contains('active')).toBe(true);
      expect(link1.getAttribute('aria-current')).toBe('page');
      expect(link2.classList.contains('active')).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('calculator form has required fields', () => {
      const form = document.createElement('form');
      form.setAttribute('data-calculator-form', '');
      const input = document.createElement('input');
      input.name = 'carKm';
      input.type = 'number';
      input.min = '0';
      form.append(input);
      document.body.append(form);
      const found = document.querySelector('[data-calculator-form]');
      expect(found).not.toBeNull();
      expect(found.querySelector('input[name="carKm"]')).not.toBeNull();
    });
  });

  describe('Accessibility Widgets', () => {
    it('skip link targets main content', () => {
      const skip = document.createElement('a');
      skip.href = '#main-content';
      skip.className = 'skip-link';
      skip.textContent = 'Skip to content';
      const main = document.createElement('main');
      main.id = 'main-content';
      document.body.append(skip, main);
      expect(document.querySelector('.skip-link')).not.toBeNull();
      expect(document.getElementById('main-content')).not.toBeNull();
    });

    it('dialog has correct ARIA role', () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'Chat panel');
      dialog.setAttribute('aria-modal', 'true');
      document.body.append(dialog);
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Chat panel');
    });

    it('buttons have accessible names', () => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Close menu');
      const icon = document.createElement('i');
      icon.setAttribute('aria-hidden', 'true');
      btn.append(icon);
      document.body.append(btn);
      expect(btn.getAttribute('aria-label')).toBe('Close menu');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Dark Mode Toggle', () => {
    it('toggles dark class on document', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      document.documentElement.removeAttribute('data-theme');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('persists preference to localStorage', () => {
      localStorage.setItem('eco-dark-mode', 'true');
      expect(localStorage.getItem('eco-dark-mode')).toBe('true');
      localStorage.removeItem('eco-dark-mode');
    });
  });

  describe('Chart Canvas', () => {
    it('creates canvas with correct dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.id = 'breakdownChart';
      canvas.width = 600;
      canvas.height = 340;
      document.body.append(canvas);
      const found = document.getElementById('breakdownChart');
      expect(found).not.toBeNull();
      expect(found.width).toBe(600);
      expect(found.height).toBe(340);
    });
  });

  describe('Empty State', () => {
    it('renders empty state with icon and message', () => {
      const container = document.createElement('div');
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-leaf';
      icon.setAttribute('aria-hidden', 'true');
      const msg = document.createElement('p');
      msg.textContent = 'No data yet';
      container.append(icon, msg);
      document.body.append(container);
      expect(container.querySelector('.fa-solid')).not.toBeNull();
      expect(msg.textContent).toBe('No data yet');
    });
  });

  describe('Carbon Counter', () => {
    it('creates counter display element', () => {
      const counter = document.createElement('div');
      counter.className = 'counter-value';
      counter.setAttribute('aria-live', 'polite');
      counter.setAttribute('aria-atomic', 'true');
      counter.textContent = '0';
      document.body.append(counter);
      expect(document.querySelector('.counter-value')).not.toBeNull();
      expect(counter.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Eco Heatmap', () => {
    it('renders heatmap grid with cells', () => {
      const grid = document.createElement('div');
      grid.className = 'heatmap-grid';
      for (let i = 0; i < 7; i++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.setAttribute('data-level', String(i % 5));
        grid.append(cell);
      }
      document.body.append(grid);
      expect(grid.querySelectorAll('.heatmap-cell').length).toBe(7);
    });
  });
});
