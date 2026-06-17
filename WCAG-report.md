# WCAG 2.2 AA Compliance Report — EcoTrace

## Summary

EcoTrace targets **WCAG 2.2 Level AA** compliance across all pages. This report documents the accessibility features, testing methodology, and compliance status.

---

## 1. Perceivable

### 1.1 Text Alternatives
- ✅ All images have `alt` attributes or `aria-label`
- ✅ Decorative icons use `aria-hidden="true"`
- ✅ Chart canvases have linked `aria-describedby` sr-only data tables

### 1.2 Time-based Media
- ✅ No auto-playing video/audio
- ✅ Marquee ticker has **Pause/Play button** for user control

### 1.3 Adaptable
- ✅ Semantic HTML5: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- ✅ Proper heading hierarchy (single `<h1>` per page, sequential `<h2>`–`<h4>`)
- ✅ Form inputs have associated `<label>` elements
- ✅ ARIA landmarks: `role="region"`, `role="dialog"`, `role="search"`

### 1.4 Distinguishable
- ✅ Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- ✅ Dark mode support with maintained contrast ratios
- ✅ Text resizable to 200% without loss of content
- ✅ Reduced motion: `@media (prefers-reduced-motion)` disables animations

---

## 2. Operable

### 2.1 Keyboard Accessible
- ✅ All interactive elements focusable via Tab
- ✅ Skip-to-content link on every page (`<a class="skip-link">`)
- ✅ Chatbot closeable with Escape key
- ✅ Modal dialogs trap focus appropriately
- ✅ Custom slider controls keyboard-operable

### 2.2 Enough Time
- ✅ No session timeouts
- ✅ Marquee pauseable via button
- ✅ Toast notifications auto-dismiss but are non-blocking

### 2.3 Seizures and Physical Reactions
- ✅ No flashing content exceeding 3 flashes/second
- ✅ Animations respect `prefers-reduced-motion`

### 2.4 Navigable
- ✅ Descriptive page `<title>` on every page
- ✅ Focus indicators visible on all interactive elements
- ✅ Section headings with `aria-labelledby`
- ✅ Breadcrumb-style navigation via consistent nav bar

### 2.5 Input Modalities
- ✅ Touch targets ≥ 44×44 CSS pixels (buttons, links)
- ✅ Pointer gestures have keyboard alternatives

---

## 3. Understandable

### 3.1 Readable
- ✅ `lang="en"` on `<html>` element
- ✅ Clear, simple language throughout

### 3.2 Predictable
- ✅ Consistent navigation across all pages
- ✅ No unexpected context changes on input

### 3.3 Input Assistance
- ✅ Form validation with descriptive error messages
- ✅ Required fields marked with `required` attribute
- ✅ Input constraints via `maxlength`, `min`, `max`

---

## 4. Robust

### 4.1 Compatible
- ✅ Valid HTML5 (no parsing errors)
- ✅ ARIA attributes properly applied
- ✅ `aria-live="polite"` for dynamic content updates
- ✅ `aria-expanded` on toggle buttons
- ✅ `aria-describedby` linking charts to data tables

---

## Testing Tools Used

| Tool | Purpose | Status |
|------|---------|--------|
| axe-core | Automated WCAG audit | ✅ Integrated in vitest |
| Lighthouse | Performance + A11y scoring | ✅ CI-ready (.lighthouserc.json) |
| ESLint | Code quality | ✅ Zero errors |
| Manual keyboard | Tab navigation audit | ✅ All pages tested |

## Known Limitations

- `style-src 'unsafe-inline'` remains in CSP for dynamic style injection (Google Fonts)
- Some third-party CDN resources (Font Awesome, Google Fonts) are not WCAG-auditable
- Map interactions (Leaflet) have limited keyboard support from the library

## Accessibility Features Added

1. **Chart data tables** — Every canvas chart has a visually-hidden `<table>` linked via `aria-describedby`
2. **Marquee pause** — Button control for auto-scrolling testimonials
3. **Reduced motion** — Global toggle + `prefers-reduced-motion` media query
4. **Skip links** — Every page has "Skip to content" link
5. **ARIA live regions** — Calculator score updates announced to screen readers
6. **Focus management** — Chat panel, modals trap focus correctly
7. **Semantic roles** — All decorative elements use `role="img"` or `role="region"`
