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
npm test          # 426 automated tests
npm run lint      # ESLint (must be 0 errors, 0 warnings)
npm run format    # Prettier formatting
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
config.js → data.js → firebase.js → gemini.js → app.js → [page modules]
```

- **config.js** — Frozen configuration, feature flags
- **data.js** — Static reference data (no side effects)
- **firebase.js** — Service layer with demo fallback
- **app.js** — Core utilities, auth, navigation (imported by all pages)
- **Page modules** — One per HTML page (calculator.js, dashboard.js, etc.)
- **features.js** — 9 self-contained features (imported on all pages)
- **chatbot.js** — Lazily loaded AI chatbot widget
