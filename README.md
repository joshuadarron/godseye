<p align="center">
  <img src="docs/banner.svg" alt="Gods Eye — Real-Time Global Tracking" width="100%" />
</p>

<p align="center">
  <strong>Track flights, satellites, vessels, and global events on a 3D globe in real time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/go-1.22+-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/cesium-3D_globe-4285F4?logo=cesium&logoColor=white" alt="CesiumJS" />
  <img src="https://img.shields.io/badge/timescaledb-time_series-FDB515?logo=timescale&logoColor=white" alt="TimescaleDB" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Quick Start

```bash
git clone https://github.com/joshuaferrara/godseye.git && cd godseye

# Start TimescaleDB + Redis
docker compose up -d

# Backend (in one terminal)
cd services/api && cp .env.example .env && go run ./cmd/server

# Frontend (in another terminal)
cd packages/frontend && pnpm install && pnpm dev
```

Open **http://localhost:5173** — you should see a 3D globe with live flights and satellites.

> **Note:** You'll need a free [Cesium Ion](https://ion.cesium.com/) token for terrain/imagery tiles. Set `VITE_CESIUM_ION_TOKEN` in your frontend `.env`. Flights require free [OpenSky Network](https://opensky-network.org/) OAuth2 credentials set in the backend `.env`.

---

## Features

- **Live flight tracking** — 9,000+ aircraft updated every second via OpenSky Network ADS-B data
- **Satellite tracking** — 14,000+ objects (ISS, Starlink, GPS, military) with client-side SGP4 orbital propagation
- **Flight route trajectories** — great-circle arc overlays from departure to arrival airport with animated dash rendering
- **Subtype classification** — flights (commercial, cargo, military, private) and satellites (Starlink, GPS, weather, science) with distinct icons and colors
- **Interactive detail panels** — click any entity for live-updating metadata, draggable/resizable HUD panels
- **Satellite orbit overlays** — full orbital path with animated dash material and nadir ground-track line
- **Satellite ground footprint** — real-time visibility cone projected onto the globe surface
- **Layer filtering** — toggle layers and subtypes on/off from the sidebar
- **1-second WebSocket updates** — Go backend streams delta payloads via Redis pub/sub fan-out
- **Time-series persistence** — all positions stored in TimescaleDB hypertables with PostGIS geography columns

---

## Architecture

```
[External APIs]
      |
      v
[Go Ingestion Workers]  ────────>  [TimescaleDB + PostGIS]
  (one per source,                   (persistence + geo queries)
   goroutine-based)
      |
      v
[Redis Pub/Sub]
      |
      v
[Go WebSocket Server]
      |
      v
[React + CesiumJS Globe]
  (1-second delta updates via WS)
```

---

## Data Layers

| Layer               | Source                            | Interval       | Status   |
| ------------------- | --------------------------------- | -------------- | -------- |
| Flights             | OpenSky Network (ADS-B)           | 1 s            | **Live** |
| Satellites          | CelesTrak TLE + SGP4              | 1 s (computed) | **Live** |
| Vessels             | AISHub, MarineTraffic             | 1-5 s          | Planned  |
| Trains              | OpenRailwayMap, Transitland, GTFS | 5-10 s         | Planned  |
| Earthquakes         | USGS Earthquake API               | Real-time      | Planned  |
| Weather Alerts      | OpenWeatherMap                    | Real-time      | Planned  |
| Armed Conflicts     | ACLED                             | 15 min         | Planned  |
| News / Geopolitical | GDELT Project                     | 15 min         | Planned  |
| Humanitarian        | ReliefWeb API                     | 15 min         | Planned  |
| Sports / Concerts   | Ticketmaster, PredictHQ           | 15 min         | Planned  |

---

## Tech Stack

| Layer           | Technology                         |
| --------------- | ---------------------------------- |
| Backend         | Go                                 |
| Database        | TimescaleDB (PostgreSQL) + PostGIS |
| Cache / Pub-Sub | Redis                              |
| WebSockets      | nhooyr.io/websocket                |
| Frontend        | React 18 + Vite + TypeScript       |
| Package Manager | pnpm                               |
| Globe           | CesiumJS (via resium)              |
| State           | Zustand                            |
| Styling         | Tailwind CSS                       |
| Infrastructure  | Docker Compose                     |

---

## Project Structure

```
godseye/
├── docker-compose.yml               # TimescaleDB + Redis
├── packages/
│   ├── frontend/                     # React + Vite + pnpm
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Globe/            # CesiumJS 3D globe + overlays
│   │   │   │   ├── HUD/              # Detail panels, tooltips, counters
│   │   │   │   └── Filters/          # Layer + subtype toggles
│   │   │   ├── registries/           # Per-layer config (icons, colors, overlays)
│   │   │   ├── stores/               # Zustand (one store per data layer)
│   │   │   ├── hooks/                # useWebSocket, useGlobeEntities
│   │   │   ├── utils/                # Route lookup, helpers
│   │   │   └── types/                # TypeScript interfaces
│   │   └── public/
│   │       ├── models/               # SVG icons for entity subtypes
│   │       └── data/                 # Static route/airport lookup data
│   └── shared/                       # Shared TS types (@godseye/shared)
│
└── services/
    └── api/                          # Go backend
        ├── cmd/server/main.go        # Entry point
        └── internal/
            ├── ingestion/            # One worker per data source
            ├── broadcast/            # Redis pub/sub → WebSocket fan-out
            ├── db/                   # Connection pool + migrations
            └── models/               # Entity types
```

---

## Environment Variables

### Backend (`services/api/.env`)

```env
DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker
REDIS_URL=redis://localhost:6379
SERVER_ADDR=:8080

# OpenSky Network — free, register at https://opensky-network.org/
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=
```

### Frontend (`packages/frontend/.env`)

```env
VITE_WS_URL=ws://localhost:8080/ws

# Cesium Ion — free, register at https://ion.cesium.com/
VITE_CESIUM_ION_TOKEN=
```

---

## Prerequisites

- [Go](https://go.dev/) 1.22+
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) and Docker Compose

---

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m "feat: Add my feature."`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## License

[MIT](LICENSE)
