---
name: nuoto-frontend
description: >-
  Builds Nuoto SwimRank React UI in frontend-v5 — API client, auth flow, time
  parsing/display, athlete search, rankings, and favorites. Use when editing
  frontend-v5, implementing API.md endpoints in the UI, or fixing OAuth redirects.
---

# Nuoto frontend (v5)

**Default target:** `frontend-v5/` only unless user specifies another version.

## Stack

React 19 + Vite + React Router 7 + JSX. No TypeScript in v5.

## Key files

| Path | Role |
|------|------|
| `src/api/index.js` | All API calls; stats cache with random TTL |
| `src/context/AuthContext.jsx` | Login state, `/api/auth/me` validation |
| `src/context/FavoritesContext.jsx` | Watchlist (localStorage) |
| `src/utils.js` | Time parsing/formatting helpers |
| `src/App.jsx` | Routes + auth guards |
| `src/pages/*` | Home, AthleteProfile, Ranking, Events, Compare, Favorites, Login |

## API usage

Read [API.md](../../API.md) before adding endpoints.

```javascript
// src/api/index.js pattern
const BASE = import.meta.env.VITE_API_BASE_URL || ''
// Production: empty BASE → relative /api/... via nginx proxy
```

- Search: min 2 chars → `GET /api/athletes/search?q=`
- Stats: `GET /api/athletes/{key}/stats` (cached 2–8 min)
- All authenticated calls send `Authorization: Bearer {token}`

## Auth flow

1. No token → redirect `/login`
2. OAuth → `/api/auth/google` or `/api/auth/apple`
3. Callback → `/auth/callback?token=...` → store `auth_token` → `/`

See [AUTH.md](../../AUTH.md) for provider setup.

## Time display

API returns apostrophe format: `"1'02.34"` or `"25.34"`. Aggregated may include trailing `"`.

Parse defensively; reuse helpers in `src/utils.js`.

## Dev

```bash
cd frontend-v5
npm install
npm run dev          # Vite dev server
# Set VITE_API_BASE_URL=http://localhost:8090 if calling backend directly
```

## Docker

```bash
docker compose -f compose.nuoto.yml --profile v5 up -d --build
```

## Do not

- Hardcode production URL in fetch calls
- Edit v1–v4 unless explicitly requested
- Add a new CSS framework — extend `src/index.css`
