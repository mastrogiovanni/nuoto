---
name: nuoto-backend-api
description: >-
  Implements or debugs the Nuoto Go REST API — Redis schema, loader phases,
  HTTP handlers, auth middleware, and records endpoints. Use when editing
  cmd/backend, querying Redis keys, or aligning frontend calls with the API.
---

# Nuoto backend API

## Docs (source of truth)

- **API contract:** [API.md](../../API.md) — endpoints, types, edge cases
- **Service internals:** [DOCS.md](../../DOCS.md) — Redis schema, loading phases
- **Auth:** [AUTH.md](../../AUTH.md) — OAuth + JWT

## Entry point

`cmd/backend/main.go` — routes, CORS, auth, Redis client.

Key files: `handlers.go`, `loader.go`, `models.go`, `auth.go` (if present).

## Redis key schema

| Key | Type | Content |
|-----|------|---------|
| `athlete:{key}` | STRING | AthleteIndex JSON |
| `athletes:names` | ZSET | `UPPERCASE_NAME\x00{key}` lex order |
| `years` | SET | Year strings |
| `year:{y}:events` | HASH | event_dir → EventInfo |
| `event:{y}:{dir}:athletes` | SET | athlete keys |
| `results:{y}:{dir}:{key}` | STRING | AthleteResult JSON |

## Loading

- Phase 1: index files → Redis + search cache (server starts after this)
- Phase 2: result files (background)
- `/api/athletes/{id}/stats` falls back to disk if result not yet in Redis
- Note: `Load()` may be commented out; aggregator may populate Redis directly

## Routes (beyond API.md basics)

```
GET  /health
GET  /api/years, /api/events/{year}, ...
GET  /api/records, /api/records/{vasca}/{championship}/{gender}
POST /api/admin/reload
GET  /api/auth/google, /api/auth/apple, callbacks
GET  /api/auth/me  (Bearer JWT required)
```

## Conventions

- Athlete `{id}` = index key (`[a-z0-9_]`)
- Event `{event}` = competition dir slug
- Times: apostrophe = minutes; aggregated adds `"` suffix
- Dates: **not normalized** — Federnuoto `"15 Marzo 2024"` vs FICR `"15/03/2024"`
- Backend is **read-only** — no competition writes via API

## Local run

```bash
redis-server &
AGGREGATED_DIR=./aggregated REDIS_ADDR=localhost:6379 go run ./cmd/backend
```

## Frontend integration

nginx proxies `/api/*` → `:8090`. Frontends use relative paths; JWT in `Authorization: Bearer`.
