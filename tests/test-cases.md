# EcoTrace Manual Test Cases

## Landing and authentication

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| AUTH-01 | Google sign-in CTA | Open `index.html`, select `Sign In with Google`. | Firebase popup opens when configured; demo session activates when not configured. |
| AUTH-02 | Email sign-in validation | Submit email form with short password. | User sees validation error and no account action is attempted. |
| AUTH-03 | Email/password account | Submit valid name, email, password with `Create account`. | Firebase account is created or demo profile is updated. |
| AUTH-04 | Protected dashboard redirect | With Firebase configured and signed out, open `dashboard.html`. | User is redirected to `index.html` and return path is saved. |

## Calculator

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| CALC-01 | Live score update | Change car km, diet, electricity bill, and shopping inputs. | Total CO₂ and category bars update without page reload. |
| CALC-02 | Step navigation | Move through Transport, Food, Energy, Shopping with Next/Back. | Only the active step is visible and the stepper state updates. |
| CALC-03 | Final result | Select `Show My Result`. | Total kg/year, India average, world average, and trees-needed comparison are shown. |
| CALC-04 | Save result | Select `Save My Result`. | Result is saved to Firestore when configured or local demo storage otherwise. |
| CALC-05 | AI tips from result | Select `Get AI Tips`. | Gemini tips are displayed when configured; static fallback tips appear on API failure. |
| CALC-06 | Edge values | Enter zeroes in all number inputs. | App does not crash and shows a bounded, readable low footprint. |
| CALC-07 | Emissions factor search | Search `flight`, `electricity`, or `clothes` on `calculator.html`. | Matching emission factor cards appear with estimate, category, details, and applicable example button. |
| CALC-08 | Apply emission example | Search `solar` or `car`, then select `Use this example`. | Calculator jumps to the relevant step, updates the field, and refreshes the live CO2 score. |

## Dashboard

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| DASH-01 | Breakdown chart | Open `dashboard.html` after a saved result. | Donut chart shows Transport, Food, Energy, and Shopping categories. |
| DASH-02 | Trend chart | Open dashboard with multiple history records. | Line chart plots monthly footprint values in chronological order. |
| DASH-03 | Score cards | Review Today, This Week, This Month cards. | Cards show daily, weekly, and monthly estimates from annual footprint. |
| DASH-04 | City comparison | Review progress bar. | Label states whether user is above or below city average. |
| DASH-05 | Activity log | Save a result, accept a challenge, or complete a tip. | Recent activity list displays the new event. |

## AI tips

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| TIPS-01 | Daily refresh | Open `tips.html`. | Five tips load and are cached for the current date. |
| TIPS-02 | Category filter | Select Transport, Food, Energy, Shopping, All. | Visible tips match selected category. |
| TIPS-03 | Mark as done | Select `Mark as Done` on a tip. | Button becomes disabled and 10 Green Points are awarded once. |
| TIPS-04 | API unavailable | Remove Gemini config and refresh. | Static fallback tips render with an explanatory status message. |

## Map

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| MAP-01 | Default map | Open `map.html`. | Google Map loads when configured; demo map placeholder appears otherwise. |
| MAP-02 | Geolocation | Select `Find Green Spots Near Me` and allow location. | Nearby markers/results update around current location. |
| MAP-03 | Permission denied | Deny location permission. | App uses default city location and shows a user-friendly message. |
| MAP-04 | Filters | Toggle EV Charging, Recycling, Tree Events, Organic Markets. | Marker/list visibility matches selected categories. |
| MAP-05 | Place search | Search a city or locality such as `Mumbai` or `Connaught Place`. | Map recenters and green spot results update around the searched place. |
| MAP-06 | Category search | Choose `EV charging` or `Recycling`, enter a place, and submit. | Results and markers are limited to the selected category near the searched place. |

## Challenges and gamification

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| GAME-01 | Accept challenge | Select `Accept` on a weekly challenge. | Points increase, challenge disables, activity is logged. |
| GAME-02 | Duplicate challenge | Reload and try the same challenge. | No duplicate points are awarded. |
| GAME-03 | Badge progress | Earn enough points for a badge. | Badge progress bar reaches 100% and shows unlocked state. |
| GAME-04 | Leaderboard | Open `challenges.html`. | Top 10 users render from Firestore public profiles or demo data. |

## Profile

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| PROF-01 | View profile | Open `profile.html`. | Photo, name, email, stats, and history table render. |
| PROF-02 | Edit profile | Change display name/photo URL and save. | Profile UI updates and Firestore/local data is updated. |
| PROF-03 | Sign out | Select `Sign Out`. | Firebase user signs out or demo mode resets. |
| PROF-04 | Delete guard | Open delete modal and submit without typing `DELETE`. | Deletion is blocked with an error toast. |
| PROF-05 | Delete account | Type `DELETE` and confirm. | Account data is deleted or demo storage is cleared. |

## Awareness feed

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| FEED-01 | Load feed | Open `feed.html`. | Google Custom Search results render when configured; curated content renders otherwise. |
| FEED-02 | Category filter | Select each topic filter. | Cards match selected topic. |
| FEED-03 | Read & earn | Select `Read & Earn 5 Points`. | Article opens, points are awarded once, button disables. |
| FEED-04 | Share article | Select `Share`. | Web Share opens when supported, otherwise article URL is copied. |

## Accessibility and performance

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| A11Y-01 | Keyboard navigation | Tab through every page. | Focus is visible, controls are reachable, and no keyboard trap occurs. |
| A11Y-02 | Skip link | Focus first element on page and activate skip link. | Focus moves to main content. |
| A11Y-03 | Screen reader labels | Inspect forms, charts, map, and buttons. | Controls have labels or accessible names. |
| A11Y-04 | Reduced motion | Enable reduced motion in OS or use page toggle where present. | Non-essential animation is minimized. |
| PERF-01 | Static load | Open pages on local static server. | Core content renders without build tooling or blocking API calls. |
| SEC-01 | Secret handling | Inspect repository for real API keys. | No private Firebase, Gemini, Maps, or Search secrets are committed. |
