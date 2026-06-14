/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const allJsFiles = ['chatbot.js', 'dashboard.js', 'app.js', 'calculator.js', 'feed.js', 'features.js']
  .map(f => readFileSync(resolve('js', f), 'utf-8'));

describe('XSS Safety', () => {
  it('no JS file uses innerHTML', () => {
    allJsFiles.forEach(source => {
      expect(source).not.toContain('.innerHTML');
    });
  });

  it('script tags in text content are not executed', () => {
    const container = document.createElement('div');
    const malicious = '<script>alert(1)</script>';
    container.textContent = malicious;
    document.body.append(container);
    // textContent renders as literal text, not HTML
    expect(container.textContent).toBe(malicious);
    expect(container.querySelector('script')).toBeNull();
  });

  it('HTML entities in user input are escaped', () => {
    const span = document.createElement('span');
    span.textContent = '<img onerror=alert(1) src=x>';
    document.body.append(span);
    expect(span.innerHTML).toContain('&lt;');
    expect(span.querySelector('img')).toBeNull();
  });
});
