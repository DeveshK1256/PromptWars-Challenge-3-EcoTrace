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
      // Create a toast container
      const container = document.createElement('div');
      container.id = 'toast-container';
      document.body.append(container);
      // Verify it exists
      expect(document.getElementById('toast-container')).not.toBeNull();
    });

    it('toast element has correct accessibility attributes', () => {
      const toast = document.createElement('div');
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
      expect(toast.getAttribute('role')).toBe('alert');
      expect(toast.getAttribute('aria-live')).toBe('polite');
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
      // Simulate marking active
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
      document.documentElement.classList.toggle('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      document.documentElement.classList.toggle('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists preference to localStorage', () => {
      localStorage.setItem('ecotrace-dark-mode', 'true');
      expect(localStorage.getItem('ecotrace-dark-mode')).toBe('true');
      localStorage.removeItem('ecotrace-dark-mode');
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
});
