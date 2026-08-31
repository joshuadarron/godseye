<p align="center">
  <img src="docs/banner.svg" alt="Gods Eye — Real-Time Global Tracking" width="100%" />
</p>

<p align="center">
  <strong>Track flights, satellites, vessels, and global events on a 3D globe in real time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/go-1.25+-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/cesium-3D_globe-4285F4?logo=cesium&logoColor=white" alt="CesiumJS" />
  <img src="https://img.shields.io/badge/timescaledb-time_series-FDB515?logo=timescale&logoColor=white" alt="TimescaleDB" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Quick Start

**macOS / Linux (bash, zsh)**

```bash
git clone https://github.com/joshuaferrara/godseye.git && cd godseye

# Start TimescaleDB + Redis + Memgraph
docker compose up -d

# API service (terminal 1)
cd services/api && cp .env.example .env && go run ./cmd/server

# Auth service (terminal 2)
cd services/auth && cp .env.example .env && go run ./cmd/server

# Frontend (terminal 3)
cd packages/frontend && cp .env.example .env && pnpm install && pnpm dev
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/joshuaferrara/godseye.git; cd godseye

# Start TimescaleDB + Redis + Memgraph
docker compose up -d

# API service (terminal 1)
cd services/api; Copy-Item .env.example .env; go run ./cmd/server

# Auth service (terminal 2)
cd services/auth; Copy-Item .env.example .env; go run ./cmd/server

# Frontend (terminal 3)
cd packages/frontend; Copy-Item .env.example .env; pnpm install; pnpm dev
```

> Windows PowerShell 5.1 has no `&&` / `||` operators — use `;` to chain, as above.
> PowerShell 7+ (`pwsh`) supports both, so either style works there.

Open **http://localhost:5173** — you should see a 3D globe with live flights and satellites. Sign-in is available via the button in the top-right corner.

> **Note:** Each service includes a `.env.example` — copy it to `.env` and fill in the values. You'll need a free [Cesium Ion](https://ion.cesium.com/) token for terrain/imagery, [OpenSky Network](https://opensky-network.org/) credentials for flights, and a shared `JWT_SECRET` between the API and auth services.

---

## Data Layers

| Layer               | Source                            | Interval       | Status   |
| ------------------- | --------------------------------- | -------------- | -------- |
| Flights             | OpenSky Network (ADS-B)           | 10 s           | **Live** |
| Satellites          | CelesTrak TLE + SGP4              | 1 s (computed) | **Live** |
| Vessels             | AISStream (AIS)                   | 5 s            | **Live** |
| Trains              | OpenRailwayMap, Transitland, GTFS | 5-10 s         | Planned  |
| Earthquakes         | USGS Earthquake API               | 5 min          | **Live** |
| Weather Alerts      | OpenWeatherMap                    | Real-time      | Planned  |
| Armed Conflicts     | ACLED                             | 15 min         | **Live** |
| News / Geopolitical | GDELT Project                     | 15 min         | Planned  |
| Humanitarian        | ReliefWeb API                     | 15 min         | Planned  |
| Sports / Concerts   | Ticketmaster, PredictHQ           | 15 min         | Planned  |

---

## Prerequisites

- [Go](https://go.dev/) 1.25+
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) and Docker Compose — on Windows, [Docker Desktop](https://www.docker.com/products/docker-desktop/) with the WSL 2 backend
- A shell: bash/zsh on macOS/Linux, or Windows PowerShell 5.1 / PowerShell 7+ on Windows

Commands below are given for both **bash/zsh** and **PowerShell**. Go, pnpm, and
Docker CLI invocations are identical across platforms; only shell built-ins
(copying files, setting env vars, chaining commands) differ.

[Memgraph](https://memgraph.com/) powers proximity detection and is started by Docker Compose — no separate install needed. The API service runs without it (the graph layer is simply disabled).

---

## Setup

### Install Dependencies

**macOS / Linux**

```bash
# Install frontend dependencies
pnpm install

# Download Go module dependencies
cd services/api && go mod download && cd ../..
```

**Windows (PowerShell)**

```powershell
# Install frontend dependencies
pnpm install

# Download Go module dependencies
cd services/api; go mod download; cd ../..
```

### Infrastructure (Docker Compose)

```bash
docker compose up -d
```

This spins up:

- **TimescaleDB** (PostgreSQL + time-series) on port `5432`
- **Redis** (cache + pub/sub) on port `6379`
- **Memgraph** (graph database, Bolt) on port `7687`

### Environment Variables

There is no root `.env` — each service reads its own. Copy the `.env.example` next to it and fill in the values:

**macOS / Linux**

```bash
cp services/api/.env.example services/api/.env
cp services/auth/.env.example services/auth/.env
cp packages/frontend/.env.example packages/frontend/.env
```

**Windows (PowerShell)**

```powershell
Copy-Item services/api/.env.example services/api/.env
Copy-Item services/auth/.env.example services/auth/.env
Copy-Item packages/frontend/.env.example packages/frontend/.env
```

**`services/api/.env`** — data ingestion + WebSocket server:

```env
DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable
REDIS_URL=redis://localhost:6379
SERVER_ADDR=:8080
JWT_SECRET=                # must match the auth service
OPENSKY_CLIENT_ID=         # https://opensky-network.org/
OPENSKY_CLIENT_SECRET=
AISSTREAM_API_KEY=         # https://aisstream.io/
ACLED_API_KEY=             # https://acleddata.com/
ACLED_EMAIL=
MEMGRAPH_BOLT_URL=bolt://localhost:7687
ALLOWED_ORIGINS=http://localhost:5173
```

**`services/auth/.env`** — JWT + OAuth:

```env
DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable
AUTH_SERVER_ADDR=:8081
JWT_SECRET=                # must match the API service
FRONTEND_URL=http://localhost:5173
OAUTH_BASE_URL=http://localhost:8081
GITHUB_CLIENT_ID=          # optional
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=          # optional
GOOGLE_CLIENT_SECRET=
```

**`packages/frontend/.env`**:

```env
VITE_WS_URL=ws://localhost:8080/ws
VITE_AUTH_URL=http://localhost:8081
VITE_CESIUM_ION_TOKEN=     # https://ion.cesium.com/
```

Required for core functionality: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (shared by both Go services), and `VITE_CESIUM_ION_TOKEN`. Data source keys are optional — a layer without its key stays empty. OAuth client IDs are optional; email/password sign-in works without them.

Generate a secret with:

**macOS / Linux**

```bash
openssl rand -hex 32
```

**Windows (PowerShell)** — no `openssl` needed:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

### Running the Backend

**macOS / Linux**

```bash
# API + WebSocket server (terminal 1)
cd services/api && go run ./cmd/server

# Auth service (terminal 2)
cd services/auth && go run ./cmd/server
```

**Windows (PowerShell)**

```powershell
# API + WebSocket server (terminal 1)
cd services/api; go run ./cmd/server

# Auth service (terminal 2)
cd services/auth; go run ./cmd/server
```

API + WebSocket server starts on `localhost:8080`; auth service on `localhost:8081`. Both run their own migrations against the shared database on startup.

### Running the Frontend

```bash
cd packages/frontend
pnpm dev
```

Vite dev server starts on `localhost:5173`.

### Running Tests

Same on every platform:

```
go test ./services/...   # Go tests (all services)
pnpm test                # Frontend tests
```

The auth service's database tests need a Postgres instance. They skip unless
`TEST_DATABASE_URL` is set, so the commands above work without one. To run them:

**macOS / Linux**

```bash
docker compose up -d
TEST_DATABASE_URL=postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable \
  go test ./services/auth/...
```

**Windows (PowerShell)** — PowerShell has no inline `VAR=value cmd` prefix, so
set the variable first:

```powershell
docker compose up -d
$env:TEST_DATABASE_URL = "postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable"
go test ./services/auth/...
```

`$env:` assignments persist for the rest of the shell session; clear with
`Remove-Item Env:\TEST_DATABASE_URL` when done.

The graph tests in `services/api/internal/graph` start a Memgraph container via
testcontainers and require a running Docker daemon.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE)
