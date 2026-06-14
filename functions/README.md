# EcoTrace — Firebase Cloud Functions

Server-side functions that power EcoTrace's backend: a leaderboard
aggregator, footprint push notifications, and a Gemini AI proxy.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| Firebase CLI | ≥ 13 |
| Firebase project | linked via `firebase use <project-id>` |

## Project structure

```
functions/
├── index.js          # All Cloud Functions (v2)
├── package.json      # Node 20, ESM
└── README.md         # ← you are here
```

## Local development

```bash
# Install dependencies
cd functions
npm install

# Start the local emulator suite (functions + Firestore)
firebase emulators:start --only functions,firestore
```

The Gemini proxy requires the `GEMINI_API_KEY` env var.
You can pass it to the emulator with:

```bash
GEMINI_API_KEY=<key> firebase emulators:start --only functions,firestore
```

## Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy a single function
firebase deploy --only functions:aggregateLeaderboard
firebase deploy --only functions:onFootprintCreated
firebase deploy --only functions:geminiProxy
```

### Environment / secrets

Set the Gemini API key as a Cloud Secret so it is **not** committed:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

The function reads the key at runtime via `process.env.GEMINI_API_KEY`.

## Available functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `aggregateLeaderboard` | Scheduled — daily at 00:00 UTC | Snapshots `publicProfiles` → `leaderboardCache/latest`. |
| `onFootprintCreated` | Firestore — `users/{uid}/footprints/{id}` create | Sends an FCM push notification with the new footprint result. |
| `geminiProxy` | HTTPS (POST, CORS) | Proxies calls to the Gemini API to keep the API key server-side. Includes per-IP rate limiting (10 s). |

## CI / CD

In GitHub Actions, deploy functions automatically after the build step:

```yaml
- name: Deploy Cloud Functions
  run: firebase deploy --only functions --token "${{ secrets.FIREBASE_TOKEN }}"
```

Or use Workload Identity Federation for keyless auth — see the
[Firebase docs](https://firebase.google.com/docs/hosting/github-integration).
