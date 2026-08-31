# CLAUDE.md — Global Tracker

Real-time global tracking app visualizing flights, satellites, vessels, and active events on a 3D CesiumJS globe. Each layer streams deltas over a single WebSocket at its own cadence and is persisted in TimescaleDB.

Live layers: flights, satellites, vessels, earthquakes (`events`), armed conflicts. Trains are a UI placeholder with no worker behind them yet — see the data-layer table in `README.md` for current status, and `ARCHITECTURE.md` for the wiring.

---

## Project Structure

```
/
├── pnpm-workspace.yaml          # JS/TS workspace packages
├── go.work                      # Go workspace linking all Go services
├── docker-compose.yml           # TimescaleDB + Redis + Memgraph for local dev
│
├── packages/
│   ├── frontend/                # React + Vite + pnpm
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Globe/       # CesiumJS layers and selection overlays
│   │   │   │   ├── HUD/         # Toolbar, layer tabs, tooltips, detail panels
│   │   │   │   └── Auth/        # Login, register, OAuth callback
│   │   │   ├── registries/      # Per-layer registration (icons, colors, panels)
│   │   │   ├── stores/          # Zustand state (one store per data layer)
│   │   │   ├── hooks/           # useWebSocket, useNearby, useEncounters, ...
│   │   │   ├── api/             # REST + auth clients
│   │   │   ├── utils/           # Classifiers, lookups, Cesium helpers
│   │   │   └── types/           # Frontend-only TypeScript interfaces
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── shared/                  # Shared TS types (@godseye/shared)
│       └── src/
│
├── services/
│   ├── api/                     # Go — main API + WebSocket server
│   │   ├── cmd/server/main.go
│   │   ├── internal/
│   │   │   ├── ingestion/       # One worker per data source
│   │   │   ├── broadcast/       # Redis pub/sub → WebSocket fanout
│   │   │   ├── graph/           # Memgraph proximity worker + queries
│   │   │   ├── api/             # REST route registration + handlers
│   │   │   ├── middleware/      # JWT auth for /api/me routes
│   │   │   └── db/              # TimescaleDB queries + migrations (PostGIS)
│   │   └── go.mod
│   ├── auth/                    # Go — auth service (email/password + GitHub/Google OAuth)
│   └── collector/               # Go — historical data collector (empty stub)
│
└── infra/                       # Future k8s/terraform configs
```

---

## Tech Stack

### Backend

- **Language**: Go
- **Database**: TimescaleDB (PostgreSQL + time-series hypertables) with PostGIS for geospatial queries
- **Graph**: Memgraph — proximity (`NEAR`) edges between flights, satellites, and vessels; optional, the API runs with the graph layer disabled when it is unreachable
- **Pub-Sub**: Redis — ingestion workers publish deltas; the broadcaster subscribes and fans out to clients. No key/value caching today, pub/sub only
- **WebSockets**: `nhooyr.io/websocket` — both the broadcast server and the AIS client
- **Pattern**: Each data source has its own goroutine-based ingestion worker with backoff/retry logic

### Frontend

- **Framework**: React 19
- **Build tool**: Vite 7
- **Package manager**: pnpm
- **Globe**: CesiumJS via Resium (3D globe, terrain, atmosphere, orbital altitude support)
- **State**: Zustand — one store per data layer (flights, satellites, vessels, earthquakes, conflicts) plus auth, connection, HUD, selection, and layer-visibility stores
- **Layer registry**: Each layer registers itself in `src/registries/` with its subtypes, icons, colors, detail panel, tooltip, and optional custom Cesium layer. Adding a layer should not require touching `App`
- **Styling**: Tailwind CSS v4 (HUD overlays, panels, filters)
- **Transport**: Native WebSocket client with delta reconciliation, batched per animation frame

### Infrastructure

- Docker Compose at project root for local dev (TimescaleDB + Redis + Memgraph)

---

## Data Sources & APIs

### Flights

- **Primary**: OpenSky Network — free, open ADS-B, REST + WebSocket
- **Secondary**: ADS-B Exchange — unfiltered (includes military), community-fed

### Vessels / Maritime

- **In use**: [AISStream](https://aisstream.io/) — free AIS WebSocket stream, `AISSTREAM_API_KEY`. The worker holds a live connection, publishes a delta every 5 s, persists every 30 s, and evicts vessels unseen for 30 min
- **Alternatives**: AISHub, MarineTraffic, or VesselFinder free developer tiers
- Includes: cargo, military, emergency, personal, tankers, cruise

### Trains

- **Global rail infrastructure**: OpenRailwayMap (OSM-based, free)
- **Real-time (where available)**: Transitland (GTFS aggregator, free), Deutsche Bahn Open API, UK National Rail Darwin
- **Fallback**: Interpolate positions from static GTFS schedule data where live GPS is unavailable
- ⚠️ Live train GPS is sparse outside Europe/UK/Japan — design the layer accordingly

### Satellites

- **Primary**: [CelesTrak](https://celestrak.org/) — free TLE (Two-Line Element) data for 20,000+ objects including ISS, Starlink, weather sats, military, debris
- **Secondary**: [Space-Track.org](https://www.space-track.org/) — official US Space Force catalog, free with registration, most authoritative source
- **Propagation**: Use **satellite.js** (JS) or **sgp4** (Go) to compute real-time orbital positions from TLE data — no live position API needed, positions are calculated client or server-side
- Includes: ISS, Starlink constellation, GPS/GNSS sats, weather sats, military sats, space debris
- ⚠️ TLE data goes stale — refresh from CelesTrak every 24 hours minimum; Starlink TLEs change frequently and need more frequent updates

### Active Events

| Category                   | Source                                              |
| -------------------------- | --------------------------------------------------- |
| Armed conflicts            | ACLED (free for research)                           |
| News / geopolitical events | GDELT Project (free, 15-min updates)                |
| Humanitarian crises        | ReliefWeb API (UN-backed, free)                     |
| Earthquakes                | USGS Earthquake API (real-time, free)               |
| Severe weather             | OpenWeatherMap Alerts (free tier)                   |
| Sports & concerts          | Ticketmaster Discovery API + PredictHQ (free tiers) |

---

## Architecture

```
[External APIs]
      │
      ▼
[Go Ingestion Workers]  ──────────────────────────►  [TimescaleDB + PostGIS]
  (one per source,                                     (persistence + geo queries)
   goroutine-based)                                            ▲
      │                                                        │
      ▼                                              [Go Auth Service :8081]
[Redis Pub/Sub]  ─────────►  [Graph Worker]  ─────►  [Memgraph]  (NEAR edges)
      │                                                  ▲
      ▼                                                  │
[Go WebSocket Server :8080]  ◄── REST /api/* ────────────┘
      │
      ▼
[React Client + CesiumJS Globe :5173]
  (per-layer delta updates, batched per animation frame)
```

The auth service is a separate Go binary sharing the database and `JWT_SECRET`
with the API. See `ARCHITECTURE.md` for the detailed diagrams.

---

## Update Cadence

Actual worker intervals, from `services/api/internal/ingestion/`:

| Layer             | Update Interval                        | Status  |
| ----------------- | -------------------------------------- | ------- |
| Flights           | 10 s poll (OpenSky)                    | live    |
| Satellites        | 1 s SGP4 propagation, 24 h TLE refresh | live    |
| Vessels           | AIS stream, 5 s publish / 30 s persist | live    |
| Earthquakes       | 5 min poll (USGS)                      | live    |
| Conflicts         | 15 min poll (ACLED)                    | live    |
| Trains            | 5–10 s (target)                        | planned |
| Weather / GDELT   | Real-time / 15 min (target)            | planned |
| Sports / Concerts | 15 min (target)                        | planned |

---

## Key Conventions

- All geo coordinates stored as PostGIS `GEOGRAPHY(POINT, 4326)` — never as raw lat/lng float columns
- TimescaleDB hypertables partitioned by `recorded_at` timestamp — always include time bounds in queries
- Redis pub/sub channels are named `channel:{layer}` — `channel:flights`, `channel:satellites`, `channel:vessels`, `channel:events` (earthquakes), `channel:conflicts`, and `channel:trains` (subscribed, no publisher yet)
- WebSocket messages are JSON delta payloads: `{ layer, action: "upsert"|"remove", entities: [...] }`, defined in `packages/shared/src/entity.ts` and mirrored by the Go models
- REST reads are public; authenticated per-user routes live under `/api/me` and are only registered when `JWT_SECRET` is set
- Frontend stores only hold the _current snapshot_ of each layer — historical data lives in the DB only
- Ingestion workers must implement exponential backoff and respect API rate limits — never hammer a free API

---

## Environment Variables

No root `.env` — each service reads its own, seeded from the `.env.example` beside it. Canonical values live in those files; see README for the annotated list.

```env
# services/api/.env
DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable
REDIS_URL=redis://localhost:6379
SERVER_ADDR=:8080
JWT_SECRET=                       # must match services/auth
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=
AISSTREAM_API_KEY=
ACLED_API_KEY=
ACLED_EMAIL=
MEMGRAPH_BOLT_URL=bolt://localhost:7687
ALLOWED_ORIGINS=http://localhost:5173

# services/auth/.env
DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable
AUTH_SERVER_ADDR=:8081
JWT_SECRET=                       # must match services/api
FRONTEND_URL=http://localhost:5173
OAUTH_BASE_URL=http://localhost:8081
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# packages/frontend/.env
VITE_WS_URL=ws://localhost:8080/ws
VITE_AUTH_URL=http://localhost:8081
VITE_CESIUM_ION_TOKEN=
```

---

## Known Constraints & Gotchas

- **CesiumJS**: Free for non-commercial use; Cesium Ion token required for terrain/imagery tiles — monitor usage
- **Train layer**: Expect coverage gaps globally; interpolation is acceptable UX for sparse regions
- **ACLED/GDELT**: Event data, not real-time second-by-second — render as static markers with timestamps, not moving entities
- **Satellite positions**: Not fetched live — derived by running SGP4 orbital propagation on TLE data every second. Refresh TLE sets from CelesTrak daily (Starlink every few hours)
- **AIS vessel data**: Commercial vessels broadcast AIS; military and some private vessels may go dark intentionally
- **Rate limits**: All free API tiers have caps — workers hold their own in-memory snapshot and diff against it rather than refetching; Redis is pub/sub only and caches nothing
- **WebSocket fan-out**: Use Redis pub/sub to decouple ingestion from client delivery — never write directly from an ingestion worker to a client connection
