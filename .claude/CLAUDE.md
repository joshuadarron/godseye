# CLAUDE.md — Global Tracker

Real-time global tracking app visualizing flights, vessels, trains, and active events on a 3D CesiumJS globe. Data streams via WebSocket at 1-second intervals, persisted in TimescaleDB.

---

## Project Structure

```
/
├── pnpm-workspace.yaml          # JS/TS workspace packages
├── go.work                      # Go workspace linking all Go services
├── docker-compose.yml           # TimescaleDB + Redis for local dev
│
├── packages/
│   ├── frontend/                # React + Vite + pnpm
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Globe/       # CesiumJS JS API wrapper
│   │   │   │   ├── HUD/         # Overlay panels, legends, counters
│   │   │   │   └── Filters/     # Layer toggles per data type
│   │   │   ├── stores/          # Zustand state (one store per data layer)
│   │   │   ├── hooks/           # useWebSocket, useGlobeEntities
│   │   │   └── types/           # Shared TypeScript interfaces
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
│   │   │   └── db/              # TimescaleDB queries (PostGIS enabled)
│   │   └── go.mod
│   ├── auth/                    # Go — auth service (placeholder)
│   └── collector/               # Go — historical data collector (placeholder)
│
└── infra/                       # Future k8s/terraform configs
```

---

## Tech Stack

### Backend

- **Language**: Go
- **Database**: TimescaleDB (PostgreSQL + time-series hypertables) with PostGIS for geospatial queries
- **Cache / Pub-Sub**: Redis — ingestion workers publish here; WebSocket server subscribes and fans out to clients
- **WebSockets**: Gorilla WebSocket or nhooyr/websocket for the real-time broadcast layer
- **Pattern**: Each data source has its own goroutine-based ingestion worker with backoff/retry logic

### Frontend

- **Framework**: React 18
- **Build tool**: Vite
- **Package manager**: pnpm
- **Globe**: CesiumJS (3D globe, terrain, atmosphere, orbital altitude support)
- **State**: Zustand — one store per data layer (flights, vessels, trains, events)
- **Styling**: Tailwind CSS (HUD overlays, panels, filters)
- **Transport**: Native WebSocket client with delta reconciliation

### Infrastructure

- Docker Compose at project root for local dev (TimescaleDB + Redis)

---

## Data Sources & APIs

### Flights

- **Primary**: OpenSky Network — free, open ADS-B, REST + WebSocket
- **Secondary**: ADS-B Exchange — unfiltered (includes military), community-fed

### Vessels / Maritime

- **Primary**: AISHub — free AIS aggregator (requires AIS feed share or key request)
- **Secondary**: MarineTraffic or VesselFinder free developer tiers
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
   goroutine-based)
      │
      ▼
[Redis Pub/Sub]
      │
      ▼
[Go WebSocket Server]
      │
      ▼
[React Client + CesiumJS Globe]
  (1-second delta updates via WS)
```

---

## Update Cadence

| Layer                 | Update Interval                          |
| --------------------- | ---------------------------------------- |
| Flights               | 1 second                                 |
| Satellites            | 1 second (computed via SGP4 propagation) |
| Vessels               | 1–5 seconds                              |
| Trains                | 5–10 seconds                             |
| Earthquakes / Weather | Real-time as events occur                |
| Conflicts / GDELT     | 15 minutes                               |
| Sports / Concerts     | 15 minutes                               |

---

## Key Conventions

- All geo coordinates stored as PostGIS `GEOGRAPHY(POINT, 4326)` — never as raw lat/lng float columns
- TimescaleDB hypertables partitioned by `recorded_at` timestamp — always include time bounds in queries
- Redis keys follow the pattern `layer:{source}:{entity_id}` (e.g., `flight:opensky:abc123`)
- WebSocket messages are JSON delta payloads: `{ layer, action: "upsert"|"remove", entities: [...] }`
- Frontend stores only hold the _current snapshot_ of each layer — historical data lives in the DB only
- Ingestion workers must implement exponential backoff and respect API rate limits — never hammer a free API

---

## Environment Variables

```env
# Backend
DATABASE_URL=postgres://user:pass@localhost:5432/globaltracker
REDIS_URL=redis://localhost:6379
OPENSKY_USERNAME=
OPENSKY_PASSWORD=
AISHUB_USERNAME=
ACLED_API_KEY=
TICKETMASTER_API_KEY=
PREDICTHQ_API_KEY=
OPENWEATHER_API_KEY=

# Frontend
VITE_WS_URL=ws://localhost:8080/ws
VITE_CESIUM_ION_TOKEN=
```

---

## Known Constraints & Gotchas

- **CesiumJS**: Free for non-commercial use; Cesium Ion token required for terrain/imagery tiles — monitor usage
- **Train layer**: Expect coverage gaps globally; interpolation is acceptable UX for sparse regions
- **ACLED/GDELT**: Event data, not real-time second-by-second — render as static markers with timestamps, not moving entities
- **Satellite positions**: Not fetched live — derived by running SGP4 orbital propagation on TLE data every second. Refresh TLE sets from CelesTrak daily (Starlink every few hours)
- **AIS vessel data**: Commercial vessels broadcast AIS; military and some private vessels may go dark intentionally
- **Rate limits**: All free API tiers have caps — the Redis cache layer is critical to avoid redundant fetches
- **WebSocket fan-out**: Use Redis pub/sub to decouple ingestion from client delivery — never write directly from an ingestion worker to a client connection
