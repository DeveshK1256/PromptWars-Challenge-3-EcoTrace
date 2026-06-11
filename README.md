# 🌍 EcoTrace — Carbon Footprint Awareness Platform

> **PromptWars Challenge 3** · Design a solution that helps individuals **understand**, **track**, and **reduce** their carbon footprint through simple actions and personalised insights.

🔗 **Live Demo:** [https://eco-tracee.netlify.app](https://eco-tracee.netlify.app)

---

## 🎯 Problem Statement Alignment

| Objective | How EcoTrace Addresses It |
|-----------|--------------------------|
| **Understand** | Multi-step calculator with 15 emission factors, India/world comparisons, Carbon Time Machine (1750–2025), country-wise emissions table |
| **Track** | Dashboard with Chart.js charts, monthly trend analysis, CSV data export, Eco Streak Heatmap (365-day activity grid) |
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

### 9 Unique Features (`features.js`)
1. 🌙 **Dark / Eco Mode** — Saves display energy, respects `prefers-color-scheme`
2. 📊 **Earth Vitals Ticker** — Scrolling global stats (temp, ice loss, CO₂ ppm, etc.)
3. ⏳ **Carbon Time Machine** — Interactive slider showing CO₂ from 1750 to 2025
4. 🌳 **Offset Visualizer** — Trees, solar panels, LEDs needed to offset your footprint
5. 🔥 **Eco Streak Heatmap** — GitHub-style 365-day activity grid
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
┌──────────────────────────────────────────────────────────┐
│                    8 HTML Pages                          │
│  index · calculator · dashboard · tips · map ·          │
│  challenges · feed · profile                            │
└──────────────────┬───────────────────────────────────────┘
                   │ ES Modules (import/export)
┌──────────────────┴───────────────────────────────────────┐
│               14 JavaScript Modules                      │
│                                                          │
│  app.js ─────── Core (auth, nav, toast, utilities)       │
│  firebase.js ── Service layer (Firebase + demo fallback) │
│  config.js ──── Frozen config object + feature flags     │
│  data.js ────── Static reference data (emissions, etc.)  │
│  gemini.js ──── Gemini AI integration                    │
│  features.js ── 9 unique self-contained features         │
│  chatbot.js ─── EcoBot AI chatbot widget                 │
│  calculator.js · dashboard.js · tips.js · map.js ·       │
│  challenges.js · feed.js · profile.js                    │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────────────┐
│                Google Services Layer                     │
│                                                          │
│  Firebase Auth ──── Google OAuth + Email/Password        │
│  Cloud Firestore ── Users, footprints, activities,       │
│                     publicProfiles (leaderboard)          │
│  Google Maps ────── Maps JS API + Places API             │
│  Gemini AI ──────── 2.0 Flash Lite (tips + chatbot)     │
│  Custom Search ──── Live news feed (optional)            │
│  Google Fonts ───── Inter, Space Grotesk, Outfit         │
│                                                          │
│  ⚡ Every service has a complete offline/demo fallback   │
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| **Authentication** | Firebase Auth (Google + Email/Password) |
| **Database** | Cloud Firestore (4 collections + security rules) |
| **AI** | Google Gemini 2.0 Flash Lite |
| **Maps** | Google Maps JavaScript API + Places |
| **Search** | Google Custom Search API |
| **Fonts** | Google Fonts (Inter, Space Grotesk, Outfit) |
| **Build** | esbuild (JS/CSS minification, 42% size reduction) |
| **Testing** | Vitest (329 automated tests, 8 suites) |
| **Linting** | ESLint (flat config, 0 errors) |
| **CI/CD** | GitHub Actions + Netlify CDN |
| **PWA** | Service Worker (cache-first + network-first) |

---

## 📁 Project Structure

```
EcoTrace/
├── index.html              # Landing page + CO₂ counter + country emissions
├── calculator.html         # Multi-step carbon footprint calculator
├── dashboard.html          # Charts, metrics, CSV export, reduction goals
├── tips.html               # AI-powered personalised eco tips
├── map.html                # Google Maps green action finder
├── challenges.html         # Weekly challenges + pledge wall + leaderboard
├── feed.html               # Environmental awareness feed
├── profile.html            # User profile + settings
│
├── css/styles.css          # Complete design system (~2500 lines)
│
├── js/
│   ├── app.js              # @module app — Core logic, auth, navigation
│   ├── firebase.js         # @module firebase — Service layer (980 lines)
│   ├── config.js           # @module config — Frozen config + feature flags
│   ├── data.js             # @module data — Static data (9 exports)
│   ├── gemini.js           # @module gemini — AI tips integration
│   ├── features.js         # @module features — 9 unique features
│   ├── chatbot.js          # @module chatbot — EcoBot AI widget
│   ├── calculator.js       # @module calculator — Footprint calculator
│   ├── dashboard.js        # @module dashboard — Charts + metrics
│   ├── tips.js             # @module tips — Personalised tips page
│   ├── map.js              # @module map — Google Maps integration
│   ├── challenges.js       # @module challenges — Gamification
│   ├── feed.js             # @module feed — News feed
│   └── profile.js          # @module profile — Profile management
│
├── tests/
│   ├── accessibility.test.js  # 162 tests — ARIA, skip links, semantic HTML
│   ├── data.test.js           # 38 tests — Data integrity + validation
│   ├── utils.test.js          # 31 tests — Utility functions
│   ├── security.test.js       # 30 tests — Firestore rules + HTTP headers
│   ├── features.test.js       # 19 tests — 9 features module validation
│   ├── gemini.test.js         # 18 tests — AI response parsing
│   ├── calculator.test.js     # 16 tests — Calculator logic + factors
│   ├── config.test.js         # 15 tests — Config structure + flags
│   └── test-cases.md          # 33 manual test scenarios
│
├── sw.js                   # Service Worker (cache-first + network-first)
├── build.js                # esbuild bundler (minify JS/CSS/HTML)
├── firestore.rules         # Firestore security rules (100 lines)
├── netlify.toml            # Netlify headers (CSP, HSTS, COOP)
├── eslint.config.js        # ESLint flat config (0 errors)
├── vitest.config.js        # Test configuration
├── .github/workflows/ci.yml # GitHub Actions CI pipeline
└── package.json            # Scripts: test, lint, build
```

---

## 📊 Code Quality

### Documentation
- **`@module` JSDoc** on all 14 JavaScript files
- **`@param` / `@returns` / `@throws`** on 80+ functions
- **`@type` annotations** on all exported data structures
- **40+ named constants** replacing magic numbers

### Standards
- **ES Modules** (`import`/`export`) throughout — zero global pollution
- **ESLint**: 0 errors, flat config with `eqeqeq`, `no-var`, `prefer-const`
- **Consistent error handling**: `try`/`catch`/`finally` in all async functions
- **DOM methods** preferred over `innerHTML` for user-generated content
- **CSS Custom Properties** for theming (30+ design tokens)
- **BEM-inspired class naming** with `data-*` attribute selectors

### Metrics
```
JS files:    14 modules
Total lines: ~4,500 (JS) + ~2,500 (CSS)
Build size:  149 KB minified (42% reduction)
ESLint:      0 errors, 5 warnings
```

---

## 🧪 Testing

**329 automated tests** across 8 test suites + 33 manual test scenarios:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint check
```

| Suite | Tests | What It Covers |
|-------|-------|----------------|
| Accessibility | 162 | ARIA attributes, skip links, CSP meta tags, semantic HTML (all 8 pages) |
| Data Integrity | 38 | Emission sorting, unique IDs, article validation, badge thresholds |
| Utility Functions | 31 | `formatKg`, `formatDate`, `clamp`, `getBadgeIds`, edge cases |
| Security Rules | 30 | Firestore rules, field validation, HTTP security headers |
| Features Module | 19 | 9 features, named constants, DOM selectors, data ranges |
| Gemini Parsing | 18 | AI response normalisation, sanitisation, fallback handling |
| Calculator Logic | 16 | Emission factors, diet baselines, transport multipliers, export |
| Config Validation | 15 | Feature flags, config immutability, API key detection |

**CI/CD**: GitHub Actions runs `npm ci && npm test` on every push/PR to `main`.

---

## 🔒 Security

### HTTP Security Headers (netlify.toml)
| Header | Value |
|--------|-------|
| Content-Security-Policy | Comprehensive policy with `default-src 'self'`, `object-src 'none'`, `form-action 'self'`, `upgrade-insecure-requests` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), payment=(), usb=(), geolocation=(self)` |

### Firestore Security Rules
- **Owner-only access**: `owns(userId)` checks `request.auth.uid == userId`
- **Field whitelists**: `safeUserFields()` and `safeFootprintFields()` restrict writable fields
- **Type validation**: `validUserData()` enforces string/int types and max lengths
- **Point cap**: `validPointChange()` limits +200 points per write
- **Immutable records**: Footprints and activities cannot be updated or deleted by users
- **Public profiles**: Read-only leaderboard with server-validated greenPoints

### Client-Side Security
- **Dual CSP**: `<meta>` tag + server headers for defence-in-depth
- **SHA-256 password hashing** for demo mode
- **Input sanitisation** via `textContent` (never `innerHTML` for user data)
- **API key scoping**: Firebase keys restricted by domain in Firebase Console

---

## ♿ Accessibility

- **Skip links** on all 8 pages (`<a class="skip-link" href="#main">`)
- **`aria-label`** on navigation, buttons, toggles, and interactive elements
- **`aria-hidden="true"`** on all decorative icons
- **`aria-live="polite"`** for dynamic content updates
- **`aria-expanded`** and **`aria-current`** for menus and navigation
- **Semantic HTML**: `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>`
- **`lang="en"`** on all pages
- **Keyboard navigation**: Escape to close menus, focus management in dialogs
- **Reduced motion**: `prefers-reduced-motion` media query + toggle button
- **Colour contrast**: `--muted: #536b5e` ensures ≥4.5:1 ratio against `--paper`
- **`.sr-only`** class for screen-reader-only text

---

## 📊 Google Services Integration

| Service | Purpose | Fallback |
|---------|---------|----------|
| **Firebase Auth** | Google OAuth + Email/Password + Password Reset | Demo mode with localStorage accounts |
| **Cloud Firestore** | User profiles, footprints, activities, leaderboard (4 collections) | localStorage with full feature parity |
| **Google Maps + Places** | Green spots map with category search | Demo markers with offset coordinates |
| **Gemini 2.0 Flash Lite** | Personalised eco tips + EcoBot chatbot | 7 curated fallback tips |
| **Google Custom Search** | Live environmental news feed | 31 curated global articles |
| **Google Fonts** | Inter, Space Grotesk, Outfit typography | System font stack |

> ⚡ **Every Google service has a complete offline fallback** — the app works fully without any API keys configured.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for testing only — the app runs without Node)
- A Firebase project (optional — works in demo mode)

### Setup
```bash
git clone https://github.com/DeveshK1256/PromptWars-Challenge-3-EcoTrace.git
cd PromptWars-Challenge-3-EcoTrace
npm install
npm test          # 329 tests
npm run lint      # 0 errors
```

### Run Locally
```bash
npx serve .       # Open http://localhost:3000
```

### Build for Production
```bash
node build.js     # Minified output → dist/ (42% smaller)
```

### Deploy
```bash
npx netlify-cli deploy --prod --dir=dist
```

---

## 📄 License

Built for the **PromptWars Virtual Challenge 3** by [Devesh Kushwaha](https://github.com/DeveshK1256).

---

<p align="center">
  <strong>🌱 Track carbon with care. Every tonne matters.</strong>
</p>
