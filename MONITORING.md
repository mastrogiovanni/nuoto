# Monitoring

Observability for the Nuoto stack is built on three components:

- **Traefik** — exposes Prometheus metrics for every HTTP request it proxies
- **Prometheus** — scrapes and stores those metrics as time-series data
- **Grafana** — visualises the metrics through a pre-provisioned dashboard

---

## Architecture

```
Internet
    │
    ▼
 Traefik :80/:443          ← edge proxy, TLS termination
    │  └─ :8082/metrics    ← internal Prometheus scrape endpoint
    │
    ├──► frontend :80       (React SPA + nginx)
    │        └──► backend :8090  (Go REST API)
    │
    ▼
 Prometheus :9090           ← pulls from traefik:8082 every 15 s
    │
    ▼
 Grafana :3000              ← queries Prometheus, renders dashboards
```

All four services share the same Docker Compose network defined in
`compose.nuoto.yml`. Prometheus and Grafana are **not** reachable from the
internet — only Grafana is bound to a host port (`3000`) for local access.
Traefik's metrics entrypoint (`:8082`) is internal-only and never published.

---

## Services

### Traefik

Image: `traefik:v3.3`

Three entrypoints are configured:

| Entrypoint | Address | Purpose |
|---|---|---|
| `web` | `:80` | HTTP — ACME challenge + redirect to HTTPS |
| `websecure` | `:443` | HTTPS with Let's Encrypt TLS |
| `metrics` | `:8082` | Internal Prometheus scrape endpoint |

Prometheus metrics flags added to the Traefik command:

```
--metrics.prometheus=true
--metrics.prometheus.entrypoint=metrics
--metrics.prometheus.addEntryPointsLabels=true
--metrics.prometheus.addServicesLabels=true
--metrics.prometheus.addRoutersLabels=true
```

`addEntryPointsLabels`, `addServicesLabels`, and `addRoutersLabels` ensure that
every metric is labelled with the originating entrypoint, backend service name,
and router name respectively. This lets Grafana break down any metric by any
of those dimensions.

Traefik exposes the following metric families (non-exhaustive):

| Metric | Type | Description |
|---|---|---|
| `traefik_entrypoint_requests_total` | Counter | Total HTTP requests per entrypoint, method, protocol, and status code |
| `traefik_entrypoint_request_duration_seconds` | Histogram | Request duration distribution per entrypoint |
| `traefik_entrypoint_open_connections` | Gauge | Current open connections per entrypoint and protocol |
| `traefik_service_requests_total` | Counter | Total requests forwarded to each backend service |
| `traefik_service_request_duration_seconds` | Histogram | Duration distribution per backend service |
| `traefik_service_open_connections` | Gauge | Current open connections to each backend service |
| `traefik_service_server_up` | Gauge | Backend server health: `1` = up, `0` = down |
| `traefik_router_requests_total` | Counter | Total requests matched per router |
| `traefik_router_request_duration_seconds` | Histogram | Duration distribution per router |

---

### Prometheus

Image: `prom/prometheus:v2.53.0`  
Config: [`monitoring/prometheus/prometheus.yml`](monitoring/prometheus/prometheus.yml)  
Data volume: `prometheus-data` (Docker named volume)

Scrape configuration:

```yaml
global:
  scrape_interval:     15s   # pull metrics from all targets every 15 s
  evaluation_interval: 15s   # evaluate alerting rules every 15 s
  scrape_timeout:      10s

scrape_configs:
  - job_name: traefik
    static_configs:
      - targets: [traefik:8082]
        labels:
          service: traefik
          environment: production
```

Key runtime flags:

| Flag | Value | Effect |
|---|---|---|
| `--storage.tsdb.retention.time` | `15d` | Metrics are kept for 15 days |
| `--web.enable-lifecycle` | — | Enables `POST /-/reload` to hot-reload config |

Prometheus is accessible **within the Docker network** at `http://prometheus:9090`.
It is not published to the host. To open the Prometheus UI temporarily:

```bash
docker compose -f compose.nuoto.yml port prometheus 9090
# or forward manually:
docker compose -f compose.nuoto.yml exec prometheus \
  wget -qO- http://localhost:9090/-/healthy
```

To force a config reload without restarting:

```bash
curl -X POST http://localhost:9090/-/reload   # from inside the container network
# or restart just Prometheus:
docker compose -f compose.nuoto.yml restart prometheus
```

---

### Grafana

Image: `grafana/grafana:11.1.0`  
Data volume: `grafana-data` (Docker named volume)  
Host port: **`3000`** → open `http://localhost:3000` in a browser

Default credentials (override via environment variables before first start):

| Variable | Default |
|---|---|
| `GRAFANA_ADMIN_USER` | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | `admin` |

**Change the password before exposing the host to the internet.**

#### Provisioning layout

```
monitoring/grafana/
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml      ← wires Prometheus as the default datasource
│   └── dashboards/
│       └── providers.yml       ← tells Grafana to load JSON files from /dashboards
└── dashboards/
    └── traefik-networking.json ← the Traefik networking dashboard
```

Both provisioning directories and the dashboards directory are mounted
read-only into the container. Changes to the JSON files on disk are picked up
automatically every 30 seconds (configured in `providers.yml`).

#### Datasource

The Prometheus datasource is provisioned automatically:

- Name: **Prometheus**
- URL: `http://prometheus:9090`
- Set as default datasource
- HTTP method: POST (more efficient for range queries)
- Minimum scrape interval hint: 15 s

---

## Dashboard: Traefik Networking

File: [`monitoring/grafana/dashboards/traefik-networking.json`](monitoring/grafana/dashboards/traefik-networking.json)  
Grafana folder: **Nuoto**  
UID: `traefik-networking-v1`  
Auto-refresh: every 30 s  
Default time range: last 1 hour

### Panels

#### Overview row — top-level stat cards

| Panel | Query | Unit |
|---|---|---|
| Request Rate | `sum(rate(traefik_entrypoint_requests_total[2m]))` | req/s |
| Error Rate (4xx+5xx) | ratio of 4xx+5xx to total, last 2 m | % |
| P50 Latency | `histogram_quantile(0.50, ...)` over entrypoint duration | seconds |
| P95 Latency | `histogram_quantile(0.95, ...)` | seconds |
| P99 Latency | `histogram_quantile(0.99, ...)` | seconds |
| Active Connections | `sum(traefik_entrypoint_open_connections)` | count |

Each stat card uses colour thresholds (green → yellow → red) so degradation is
immediately visible without reading the number.

#### Request Rate & Traffic

- **Request Rate by Entrypoint** — time series showing req/s split by `web`
  and `websecure` entrypoints.
- **Request Rate by Service** — req/s split by backend service name (e.g.
  `frontend`, `api`).

#### Latency & Response Time

- **Request Duration Percentiles (Entrypoint)** — P50 / P90 / P95 / P99 on a
  single chart for the combined entrypoint traffic. Use this as the primary
  latency signal.
- **Request Duration Percentiles by Service** — P50 / P95 / P99 broken down
  per backend service. Useful to isolate whether latency originates in the
  frontend nginx layer or the Go backend.

#### Error Rate

- **Requests by HTTP Status Code** — four stacked-area series: 2xx, 3xx, 4xx,
  5xx. A rising 5xx band indicates a backend problem; a rising 4xx band usually
  means client errors or a routing misconfiguration.
- **Error Rate % by Service** — percentage of error responses per backend
  service over time.

#### Connections

- **Open Connections by Entrypoint** — current in-flight connections labelled
  by entrypoint and protocol (HTTP/HTTPS/TCP).
- **Open Connections by Service** — connections held open to each backend.

#### Service Health

- **Backend Server Health** — live table. Each row is a backend server
  registered with Traefik; the `Status` column shows **UP** (green) or
  **DOWN** (red) based on `traefik_service_server_up`.

---

## Starting the monitoring stack

The monitoring services are part of `compose.nuoto.yml` and start alongside
the application:

```bash
export ACME_EMAIL=you@example.com
export GRAFANA_ADMIN_PASSWORD=changeme   # recommended

docker compose -f compose.nuoto.yml up -d
```

Check that all services are healthy:

```bash
docker compose -f compose.nuoto.yml ps
```

Verify Prometheus is scraping Traefik successfully:

```bash
# Open a shell in the Prometheus container and query the targets API
docker compose -f compose.nuoto.yml exec prometheus \
  wget -qO- 'http://localhost:9090/api/v1/targets' | python3 -m json.tool | grep health
```

Expected output: `"health": "up"` for the `traefik` job.

---

## Stopping / upgrading

Stop all services (data volumes are preserved):

```bash
docker compose -f compose.nuoto.yml down
```

Upgrade Prometheus or Grafana by changing the image tag in `compose.nuoto.yml`
and running:

```bash
docker compose -f compose.nuoto.yml pull prometheus grafana
docker compose -f compose.nuoto.yml up -d prometheus grafana
```

---

## Extending the monitoring setup

### Add more scrape targets

Edit [`monitoring/prometheus/prometheus.yml`](monitoring/prometheus/prometheus.yml)
and add a new entry under `scrape_configs`:

```yaml
  - job_name: my-service
    static_configs:
      - targets: [my-service:8080]
```

Then reload Prometheus:

```bash
docker compose -f compose.nuoto.yml restart prometheus
```

### Add more dashboards

Drop any Grafana dashboard JSON file into
[`monitoring/grafana/dashboards/`](monitoring/grafana/dashboards/).
Grafana picks it up within 30 seconds (no restart needed).

To download community dashboards from grafana.com, use the dashboard ID:

```bash
curl -o monitoring/grafana/dashboards/redis.json \
  "https://grafana.com/api/dashboards/763/revisions/latest/download"
```

### Expose Prometheus to the host (optional)

If you need direct access to the Prometheus UI, add a `ports` entry to the
`prometheus` service in `compose.nuoto.yml`:

```yaml
  prometheus:
    ports:
      - "9090:9090"
```

Do not do this on a server with a public IP unless Prometheus is protected
by a firewall or authentication proxy.

### Expose Grafana via Traefik (optional)

To serve Grafana on `https://mastrogiovanni.ddns.net/grafana` instead of a
raw port, add Traefik labels to the `grafana` service and set
`GF_SERVER_ROOT_URL`:

```yaml
  grafana:
    environment:
      GF_SERVER_ROOT_URL: https://mastrogiovanni.ddns.net/grafana
      GF_SERVER_SERVE_FROM_SUB_PATH: "true"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(`mastrogiovanni.ddns.net`) && PathPrefix(`/grafana`)"
      - "traefik.http.routers.grafana.entrypoints=websecure"
      - "traefik.http.routers.grafana.tls=true"
      - "traefik.http.routers.grafana.tls.certresolver=letsencrypt"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"
    ports: []   # remove the host port binding
```
