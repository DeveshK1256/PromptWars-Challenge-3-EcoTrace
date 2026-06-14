# Contributing to EcoTrace

Thank you for your interest in contributing to EcoTrace! This document provides guidelines and standards for contributions.

## Development Setup

```bash
git clone https://github.com/DeveshK1256/PromptWars-Challenge-3-EcoTrace.git
cd PromptWars-Challenge-3-EcoTrace
npm install
```

## Code Standards

### JavaScript
- **ES Modules** — Use `import`/`export` for all module communication
- **`const`/`let`** only — Never use `var`
- **Strict equality** — Always use `===` (enforced by ESLint)
- **JSDoc** — Every function must have `@param`, `@returns`, and `@throws` tags
- **Named constants** — No magic numbers; use `UPPER_CASE` constants
- **Safe DOM** — Use `createElement`/`textContent`/`append` instead of `innerHTML`
- **Error handling** — Wrap all async operations in `try/catch/finally`

### CSS
- **Custom Properties** — Use design tokens from `:root` (e.g., `var(--forest)`)
- **Logical properties** — Prefer `inline-size`/`block-size` over `width`/`height`
- **BEM-inspired** — Use `.component-element` naming with `data-*` selectors

### File Organisation
- One module per file, max ~300 lines preferred
- Group related functions with section comments (`/* ===== SECTION ===== */`)
- Imports at the top, exports clearly marked

## Quality Checks

Run all checks before submitting:

```bash
npm test          # 383 unit tests (Vitest + jsdom)
npm run lint      # ESLint (must be 0 errors, 0 warnings)
npm run format    # Prettier formatting
npm run test:e2e  # Playwright E2E tests (requires browsers)
node build.js     # Production build
```

## Commit Messages

Use conventional commit format:
```
type: description

Examples:
feat: add CSV export to dashboard
fix: correct contrast ratio for muted text
docs: add JSDoc to calculator functions
refactor: extract createTableRow helper
test: add code quality validation tests
```

## Architecture

All JS modules follow this dependency flow:

```
config.js → config.env.js → data.js → firebase.js → gemini.js → app.js → [page modules]
```

- **config.js / config.env.js** — Frozen configuration, env vars, feature flags
- **logger.js** — Centralised logging (no raw `console.*` calls)
- **data.js / data-countries.js** — Static reference data (no side effects)
- **firebase.js / demo-store.js** — Service layer with demo fallback
- **gemini.js** — AI integration (proxy → configured proxy → direct fallback)
- **app.js / app-auth.js** — Core utilities, auth UI, navigation
- **Page modules** — One per HTML page (calculator.js, dashboard.js, etc.)
- **features.js / features-social.js** — 9 self-contained features
- **chatbot.js** — Lazily loaded AI chatbot widget
- **netlify/functions/gemini.js** — Server-side Gemini proxy (rate-limited)
- **functions/index.js** — Firebase Cloud Functions (scheduled + triggers)
