---
name: nuoto-pipeline
description: >-
  Operates Nuoto data pipeline and deployment — Airflow DAG, Docker scraper
  image, compose profiles, Traefik, Redis, backup scripts. Use when editing
  dags/scrapers_dag.py, Dockerfiles, compose.nuoto.yml, or scheduling scrapes.
---

# Nuoto pipeline & deployment

## Airflow DAG

File: `dags/scrapers_dag.py`

```
Schedule: 0 2 * * * (daily 02:00)
Image:    nuoto-scrapers:latest

ficr (current year) ─────────────┐
                                 ├── aggregate → Redis
federnuoto → master → records ───┘
```

Aggregator command includes `-redis-addr redis:6379` on network `nuoto-scraper`.

Update `DATA_ROOT` in the DAG to match the host path for bind mounts.

## Docker images

| Dockerfile | Produces |
|------------|----------|
| `Dockerfile.scrapers` | ficr, federnuoto, aggregator binaries |
| `Dockerfile.backend` | Go API |
| `Dockerfile.frontend-v5` | nginx + SPA (latest UI) |

Build scrapers: `./build-scraper-image.sh`

## Production stack

`compose.nuoto.yml`:

- **Traefik** — HTTPS, Let's Encrypt
- **redis** — data store (:6379)
- **backend** — internal :8090
- **frontend-v5** — profile `v5` (only one frontend profile at a time)
- **prometheus + grafana** — monitoring

```bash
export JWT_SECRET=$(openssl rand -hex 32)
# + OAuth vars per AUTH.md
docker compose -f compose.nuoto.yml --profile v5 up -d --build
```

Profiles: `v1`, `v2`, `v3`, `v4`, `v5`.

## Airflow stack

`compose.airflow.yml` — separate from app stack.

## Backup

`backup.sh` — rsync scraped data to NAS.

## Env & secrets

See [AUTH.md](../../AUTH.md). Required: `JWT_SECRET`. OAuth vars per provider.

Never commit `.env`, Apple `.p8`, or scraped data.

## Monitoring

[MONITORING.md](../../MONITORING.md) — Traefik metrics, Prometheus scrape, Grafana dashboards.

## Common ops

```bash
docker compose -f compose.nuoto.yml logs -f backend
docker compose -f compose.nuoto.yml --profile v5 up -d --build frontend-v5
```

## Stale doc note

[DOCS.md](../../DOCS.md) references `compose.backend.yml` — use `compose.nuoto.yml` instead.
