# EcoTrace Evaluation Readiness

This document maps EcoTrace to the requested evaluation criteria and highlights where live credentials are still required.

## 1. Code Quality

- Vanilla HTML/CSS/ES modules with clear separation by page and concern.
- Shared modules: `app.js`, `firebase.js`, `config.js`, `data.js`, `gemini.js`.
- Page modules keep feature logic isolated: calculator, dashboard, map, challenges, tips, profile, feed.
- Demo fallbacks preserve functionality when external services are not configured.

## 2. Security

- Firebase config is centralized in `js/config.js`.
- Gemini recommends a server-side proxy endpoint so the model key does not need to be exposed in the browser.
- Firestore rules restrict user documents to the authenticated owner.
- Public leaderboard data is separated into `publicProfiles`.
- Firebase Hosting includes CSP, `nosniff`, frame protection, referrer policy, and permissions policy headers.
- Delete account flow requires explicit confirmation text.

## 3. Efficiency

- Static Firebase Hosting architecture with no build step.
- CDN-loaded heavy libraries are limited to pages that need them.
- Chart.js has local canvas fallbacks so dashboards still render when CDN loading fails.
- Map and feed API calls are lazy and fallback gracefully.
- CSS/JS assets are cacheable through Firebase Hosting headers.

## 4. Testing

- Manual test cases are documented in `tests/test-cases.md`.
- Tests cover auth, calculator, dashboard, tips, map, challenges, profile, feed, accessibility, performance, and security.
- Current verification performed: JS syntax checks and browser smoke checks for key pages.

## 5. Accessibility

- Semantic landmarks, headings, labels, fieldsets, and ARIA live regions are used throughout.
- Skip links and visible focus states are included.
- Forms have accessible labels and validation messages.
- Motion respects reduced-motion preferences.
- Charts include role/label text and canvas fallbacks.

## 6. Google Services

- Firebase Authentication support: Google Sign-In and Email/Password.
- Firestore support: footprints, user profile, activity, points, leaderboard data.
- Google Maps JavaScript API and Places API support: live map, nearby spots, filters, geolocation.
- Gemini API support: personalized tips with static fallback.
- Google Custom Search API support: awareness feed with curated fallback.

## 7. Problem Statement Alignment

- All eight required pages are implemented.
- Required calculator steps, score comparison, tree offset, save result, and AI tips are included.
- Dashboard includes breakdown, trend, score cards, city comparison, streak, and activity.
- Map includes green spot categories, markers, info windows, geolocation, and search.
- Challenges include badges, leaderboard, points, and wallet.
- Feed includes category filters, read-and-earn, and sharing.

## Remaining Credentials

- Firebase web app config: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
- Google Custom Search CX: `customSearchCx`.
- Gemini: preferably `proxyEndpoint`; otherwise `apiKey` for local demo only.

Already configured:

- Google Maps JavaScript API key.
- Google Places API key.
- Google Custom Search API key.
