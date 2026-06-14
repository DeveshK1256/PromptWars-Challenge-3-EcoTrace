# 🌍 EcoTrace — Carbon Footprint Awareness Platform

> **PromptWars Challenge 3** · Design a solution that helps individuals **understand**, **track**, and **reduce** their carbon footprint through simple actions and personalised insights.

🔗 **Live Demo:** [https://eco-tracee.netlify.app](https://eco-tracee.netlify.app)

---

## 🎯 Problem Statement Alignment

| Objective | How EcoTrace Addresses It |
|-----------|--------------------------|
| **Understand** | Multi-step calculator with 15 emission factors, India/world comparisons, Carbon Time Machine (1750–2025), country-wise emissions table |
| **Track** | Dashboard with Chart.js charts, monthly trend analysis, CSV data export, Eco Streak Heatmap (365-day real activity grid) |
| **Reduce** | AI-powered personalised tips (Gemini 2.0), weekly challenges, personalised reduction goals, Offset Visualizer, Green Action Map |
| **Simple Actions** | Gamified challenges (+Green Points), badge progression, pledge wall, tip completion tracking |
| **Personalised Insights** | Gemini AI analyses your breakdown and generates targeted tips; dashboard shows monthly % change; reduction goals adapt to your highest category |

---

## ✨ Features

### Core Pages (8 pages)
- 🧮 **Carbon Calculator** — 4-step form (Transport, Food, Energy, Shopping) with real-time scoring, emission factor search (15 categories), and comparison bars
- 📊 **Dashboard** — Donut chart, trend line, CSV export, monthly comparison, personalised reduction goals, Eco Streak Heatmap
- 💡 **AI Tips** — Gemini-powered personalised tips with category filters and "Mark as Done" tracking
- 🗺️ **Green Action Map** — Google Maps + Places API for EV stations, recycling, tree events, organic markets
- 🏆 **Challenges** — Weekly eco-challenges, 4-tier badge system, Green Points leaderboard, Eco Pledge Wall
- 📰 **Awareness Feed** — 31 curated global articles + Google Custom Search live feed, topic filters
- 👤 **Profile** — Stats, history, edit profile, delete account with confirmation
- 🏠 **Homepage** — Live CO₂ counter, country emissions table (2020–2025), Earth Vitals ticker

### 9 Unique Features
1. 🌙 **Dark / Eco Mode** — Saves display energy, respects `prefers-color-scheme`
2. 📊 **Earth Vitals Ticker** — Scrolling global stats (temp, ice loss, CO₂ ppm, etc.)
3. ⏳ **Carbon Time Machine** — Interactive slider showing CO₂ from 1750 to 2025
4. 🌳 **Offset Visualizer** — Trees, solar panels, LEDs needed to offset your footprint
5. 🔥 **Eco Streak Heatmap** — GitHub-style 365-day activity grid with real data + tooltips
6. 📷 **Share Score Card** — Canvas-generated PNG scorecard download
7. 🔊 **Ambient Nature Sounds** — Web Audio API brown noise + bird chirps
8. ✊ **Eco Pledge Wall** — Community pledges with likes (localStorage)
9. 📊 **Footprint Comparison** — Animated bar chart vs 8 country averages

### AI Features
- 🤖 **EcoBot** — Floating chatbot on every page powered by Gemini AI
- 💡 **Personalised Tips** — AI analyses your calculator breakdown and generates targeted advice
- 🎯 **Reduction Goals** — Auto-generated targets based on your highest-emitting category

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    8 HTML Pages                               │
│  index · calculator · dashboard · tips · map ·               │
│  challenges · feed · profile                                 │
└──────────────────┬───────────────────────────────────────────┘
                   │ ES Modules (import/export)
┌──────────────────┴───────────────────────────────────────────┐
│               23 JavaScript Modules                          │
│                                                              │
│  Core ──────── app.js · app-auth.js · config.js ·            │
│                config.env.js · logger.js                     │
│                                                              │
│  Services ──── firebase.js · demo-store.js · gemini.js       │
│                                                              │
│  Data ──────── data.js · data-countries.js ·                 │
│                emission-factors.js                            │
│                                                              │
│  Features ──── features.js · features-social.js ·            │
│                chatbot.js                                     │
│                                                              │
│  Pages ─────── calculator.js · dashboard.js ·                │
│                dashboard-charts.js · tips.js · map.js ·      │
│                map-search.js · challenges.js · feed.js ·     │
│                profile.js                                     │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────────────────┐
│                Google Services Layer                         │
│                                                              │
│  Firebase Auth ──── Google OAuth + Email/Password            │
│  Cloud Firestore ── Users, footprints, activities,           │
│                     publicProfiles (leaderboard)             │
│  Firebase App Check  reCAPTCHA Enterprise                    │
│  Google Maps ────── Maps JS API + Places API                 │
│  Gemini AI ──────── 2.0 Flash Lite (tips + chatbot)          │
│  Custom Search ──── Live news feed                           │
│  Google Fonts ───── Inter, Space Grotesk, Outfit             │
│                                                              │
│  ⚡ Every service has a complete offline/demo fallback       │
└──────────────────────────────────────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────────────────┐
│              Server-Side (Netlify Functions)                  │
│                                                              │
│  functions/gemini.js ── Gemini API proxy (rate-limited)      │
│                                                              │
│              Firebase Cloud Functions (scaffolded)            │
│                                                              │
│  functions/index.js ─── Leaderboard aggregation (scheduled)  │
│                         Footprint FCM notifications          │
│                         Gemini proxy (HTTPS callable)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| **Authentication** | Firebase Auth (Google + Email/Password) + App Check |
| **Database** | Cloud Firestore (4 collections + security rules) |
| **AI** | Google Gemini 2.0 Flash Lite |
| **Maps** | Google Maps JavaScript API + Places |
| **Search** | Google Custom Search API |
| **Fonts** | Google Fonts (Inter, Space Grotesk, Outfit) |
| **Server** | Netlify Functions (Gemini proxy) + Firebase Functions |
| **Build** | esbuild (JS/CSS minification, 48% size reduction) |
| **Unit Testing** | Vitest (383 tests, 12 suites) + jsdom |
| **E2E Testing** | Playwright (16 tests, Desktop Chrome + Mobile Safari) |
| **Performance** | Lighthouse CI (`lhci autorun`, score thresholds) |
| **Linting** | ESLint (19 rules, flat config, 0 errors) |
| **Formatting** | Prettier + EditorConfig |
| **CI/CD** | GitHub Actions → Netlify CDN |
| **PWA** | Service Worker (cache-first + network-first) |

---

## 📁 Project Structure

```
EcoTrace/
├── index.html                  # Landing page + CO₂ counter + country emissions
├── calculator.html             # Multi-step carbon footprint calculator
├── dashboard.html              # Charts, metrics, CSV export, reduction goals
├── tips.html                   # AI-powered personalised eco tips
├── map.html                    # Google Maps green action finder
├── challenges.html             # Weekly challenges + pledge wall + leaderboard
├── feed.html                   # Environmental awareness feed
├── profile.html                # User profile + settings
│
├── css/
│   └── styles.css              # Complete design system (~2,500 lines)
│
├── js/                         # 23 ES modules (avg 294 lines/file)
│   ├── app.js                  # Core logic, navigation, utilities
│   ├── app-auth.js             # Authentication UI handlers
│   ├── config.js               # Frozen config + feature flags
│   ├── config.env.js           # Build-time env var placeholders
│   ├── logger.js               # Centralised logging utility
│   ├── firebase.js             # Service layer (Firebase + demo fallback)
│   ├── demo-store.js           # Demo-mode localStorage helpers
│   ├── gemini.js               # Gemini AI integration (3-tier fallback)
│   ├── data.js                 # Static reference data
│   ├── data-countries.js       # Country emissions dataset
│   ├── emission-factors.js     # Searchable emission factor database
│   ├── features.js             # Dark mode, time machine, ambient sounds
│   ├── features-social.js      # Heatmap, share card, pledge wall
│   ├── chatbot.js              # EcoBot AI chatbot widget
│   ├── calculator.js           # Footprint calculator logic
│   ├── dashboard.js            # Dashboard rendering + CSV export
│   ├── dashboard-charts.js     # Chart.js + canvas fallback charts
│   ├── map.js                  # Google Maps UI
│   ├── map-search.js           # Geocoding + Places search logic
│   ├── tips.js                 # Tips page controller
│   ├── challenges.js           # Challenges + gamification
│   ├── feed.js                 # News feed controller
│   └── profile.js              # Profile management
│
├── tests/                      # 383 unit tests (Vitest)
│   ├── accessibility.test.js   # 37 tests — ARIA, skip links, contrast
│   ├── code-quality.test.js    # 153 tests — JSDoc, constants, modules
│   ├── data.test.js            # 38 tests — Data integrity + validation
│   ├── security.test.js        # 30 tests — Firestore rules + headers
│   ├── features.test.js        # 19 tests — 9 features validation
│   ├── gemini.test.js          # 18 tests — AI response parsing
│   ├── calculator.test.js      # 16 tests — Emission factors + logic
│   ├── config.test.js          # 15 tests — Config structure + flags
│   ├── utils.test.js           # 31 tests — Utility functions
│   ├── dom/                    # jsdom-based DOM tests
│   │   ├── dom.test.js         # 11 tests — DOM manipulation
│   │   ├── calculator.test.js  # 12 tests — Calculator UI interactions
│   │   └── xss.test.js         # 3 tests — XSS safety verification
│   └── test-cases.md           # 33 manual test scenarios
│
├── e2e/                        # Playwright end-to-end tests
│   ├── homepage.spec.js        # Homepage load + dark mode + counter
│   ├── calculator.spec.js      # Calculator flow + form inputs
│   └── navigation.spec.js      # 8-page smoke tests + skip links
│
├── functions/                  # Firebase Cloud Functions (scaffolded)
│   ├── index.js                # Leaderboard aggregation + FCM + Gemini proxy
│   ├── package.json            # firebase-admin + firebase-functions
│   └── .eslintrc.json          # Node.js ESLint config
│
├── netlify/
│   └── functions/
│       └── gemini.js           # Netlify serverless Gemini proxy (rate-limited)
│
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: lint → test → build → Lighthouse → E2E
│
├── sw.js                       # Service Worker (cache-first + network-first)
├── build.js                    # esbuild bundler (minify + env replacement)
├── firestore.rules             # Firestore security rules
├── firebase.json               # Firebase hosting + functions config
├── netlify.toml                # Netlify headers (CSP, HSTS, COOP)
├── eslint.config.js            # ESLint flat config (19 rules)
├── vitest.config.js            # Vitest multi-project config (unit + dom)
├── playwright.config.js        # Playwright config (Chrome + Mobile Safari)
├── lighthouserc.js             # Lighthouse CI thresholds
├── .prettierrc                 # Code formatting rules
├── .editorconfig               # Editor settings
├── .env.example                # Environment variable template
├── CONTRIBUTING.md             # Contributor guidelines
└── package.json                # Scripts: test, lint, build, test:e2e
```

---

## 📊 Code Quality

### Metrics
```
JS modules:     23 files (avg 294 lines/file)
Total lines:    ~6,750 (JS) + ~2,500 (CSS)
Build size:     159 KB minified (48% reduction)
JSDoc:          445 annotations (@module on 100% of files)
Named constants: 113 UPPER_CASE constants
ESLint:         0 errors, 0 warnings (19 rules)
```

### Standards
- **ES Modules** (`import`/`export`) throughout — zero global pollution
- **ESLint**: 0 errors, flat config with `eqeqeq`, `no-var`, `prefer-const`, `prefer-template`
- **JSDoc**: `@module` header on every file, `@param`/`@returns`/`@throws` on all functions
- **Named constants**: 113 `UPPER_CASE` constants replacing magic numbers
- **Consistent error handling**: `try`/`catch` in all async functions (57 blocks)
- **Zero innerHTML**: DOM API (`textContent`, `createElement`, `append`) everywhere
- **Centralised logging**: `logger.js` utility (0 raw `console.*` calls)
- **CSS Custom Properties**: 30+ design tokens for consistent theming
- **BEM-inspired naming** with `data-*` attribute selectors

---

## 🧪 Testing

**383 automated tests** across 12 test suites + 16 E2E tests + 33 manual scenarios:

```bash
npm test              # Run all 383 unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report (70% branch threshold)
npm run lint          # ESLint check
npm run test:e2e      # Playwright end-to-end tests
```

### Unit Tests (Vitest + jsdom)

| Suite | Tests | What It Covers |
|-------|-------|----------------|
| Code Quality | 153 | JSDoc headers, named constants, error handling, ES modules |
| Accessibility | 37 | ARIA attributes, skip links, semantic HTML, colour contrast |
| Data Integrity | 38 | Emission sorting, unique IDs, article validation, badge thresholds |
| Utility Functions | 31 | `formatKg`, `formatDate`, `clamp`, `getBadgeIds`, edge cases |
| Security Rules | 30 | Firestore rules, field validation, HTTP security headers |
| Features Module | 19 | 9 features, named constants, DOM selectors, data ranges |
| Gemini Parsing | 18 | AI response normalisation, sanitisation, fallback handling |
| Calculator Logic | 16 | Emission factors, diet baselines, transport multipliers |
| Config Validation | 15 | Feature flags, config immutability, API key detection |
| DOM (jsdom) | 11 | Toast, navigation, form validation, dark mode, canvas |
| Calculator UI | 12 | Step panels, input events, result panel, search form |
| XSS Safety | 3 | No innerHTML, script injection, HTML entity escaping |

### E2E Tests (Playwright)

| Suite | Tests | What It Covers |
|-------|-------|----------------|
| Homepage | 5 | Page load, nav links, skip link, dark mode, carbon counter |
| Calculator | 4 | Page load, step navigation, transport inputs, emission search |
| Navigation | 16 | 8-page smoke tests (no console errors + skip links) |

### CI/CD Pipeline
```
GitHub Actions: lint → test → build → Lighthouse CI → E2E (on PRs)
```

---

## 🔒 Security

### HTTP Security Headers (netlify.toml)
| Header | Value |
|--------|-------|
| Content-Security-Policy | Comprehensive policy with `default-src 'self'`, `object-src 'none'`, `upgrade-insecure-requests` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), payment=(), usb=(), geolocation=(self)` |

### API Security
- **Environment variables**: All API keys in `.env` (git-ignored), replaced at build time
- **Server-side proxy**: Gemini API key never reaches the browser (`netlify/functions/gemini.js`)
- **Rate limiting**: 1 call per 10 seconds per IP on the Gemini proxy
- **Firebase App Check**: reCAPTCHA Enterprise prevents unauthorized API access

### Firestore Security Rules
- **Owner-only access**: `request.auth.uid == userId`
- **Field whitelists**: Only allowed fields can be written
- **Type validation**: Enforces string/int types and max lengths
- **Point cap**: Limits +200 points per write
- **Immutable records**: Footprints and activities cannot be updated/deleted

### Client-Side Security
- **Dual CSP**: `<meta>` tag + server headers for defence-in-depth
- **SHA-256 password hashing** for demo mode
- **Zero innerHTML**: DOM API (`textContent`) prevents XSS
- **API key scoping**: Firebase keys restricted by domain

---

## ♿ Accessibility

- **Skip links** on all 8 pages
- **`aria-label`** on navigation, buttons, toggles, and interactive elements
- **`aria-hidden="true"`** on all decorative icons
- **`aria-live="polite"`** for dynamic content updates
- **`aria-expanded`** and **`aria-current`** for menus and navigation
- **Semantic HTML**: `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>`
- **`lang="en"`** on all pages
- **Keyboard navigation**: Escape to close menus, focus management in dialogs
- **Reduced motion**: `prefers-reduced-motion` media query + toggle button
- **Colour contrast**: ≥4.5:1 ratio verified with automated testing
- **`.sr-only`** class for screen-reader-only text

---

## 📊 Google Services Integration

| Service | Purpose | Fallback |
|---------|---------|----------|
| **Firebase Auth** | Google OAuth + Email/Password + Password Reset | Demo mode with localStorage accounts |
| **Cloud Firestore** | User profiles, footprints, activities, leaderboard | localStorage with full feature parity |
| **Firebase App Check** | reCAPTCHA Enterprise — blocks unauthorized clients | Graceful degradation |
| **Firebase Functions** | Leaderboard aggregation, FCM notifications, Gemini proxy | Netlify Functions fallback |
| **Google Maps + Places** | Green spots map with category search | Demo markers with offset coordinates |
| **Gemini 2.0 Flash Lite** | Personalised eco tips + EcoBot chatbot | 7 curated fallback tips |
| **Google Custom Search** | Live environmental news feed | 31 curated global articles |
| **Google Fonts** | Inter, Space Grotesk, Outfit typography | System font stack |

> ⚡ **Every Google service has a complete offline fallback** — the app works fully without any API keys configured.

---

## 🔐 Environment Variables

All sensitive keys are loaded from a **`.env`** file at the project root (git-ignored).
Copy the template and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket URL |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_MAPS_API_KEY` | Google Maps / Places API key |
| `VITE_GEMINI_KEY` | Google Gemini AI API key |
| `VITE_GOOGLE_SEARCH_KEY` | Google Custom Search API key |
| `VITE_GOOGLE_SEARCH_CX` | Google Custom Search engine ID |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key (optional) |

> See [`.env.example`](.env.example) for the full template.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for testing and building)
- A Firebase project (optional — works in demo mode)

### Setup
```bash
git clone https://github.com/DeveshK1256/PromptWars-Challenge-3-EcoTrace.git
cd PromptWars-Challenge-3-EcoTrace
cp .env.example .env          # Configure your API keys
npm install
npm test                      # 383 unit tests
npm run lint                  # 0 errors
```

### Run Locally
```bash
npx serve .                   # Open http://localhost:3000
```

### Build for Production
```bash
node build.js                 # Minified output → dist/ (48% smaller)
```

### Deploy
```bash
npx netlify-cli deploy --prod --dir=dist
```

### Run E2E Tests
```bash
npx playwright install chromium
npm run test:e2e
```

---

## 📄 License

Built for the **PromptWars Virtual Challenge 3** by [Devesh Kushwaha](https://github.com/DeveshK1256).

---

<p align="center">
  <strong>🌱 Track carbon with care. Every tonne matters.</strong>
</p>
