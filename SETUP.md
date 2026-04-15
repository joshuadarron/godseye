# Setup Guide

## Prerequisites

- **Go** 1.21+
- **Node.js** 18+ with **pnpm** 8+
- **Docker** and **Docker Compose**
- **Memgraph** (graph database for proximity detection)

## Clone & Install

```bash
git clone https://github.com/JoshuaDarron/godseye.git
cd godseye

# Install frontend dependencies
pnpm install

# Download Go module dependencies
cd services/api && go mod download && cd ../..
```

## Infrastructure (Docker Compose)

Start TimescaleDB and Redis:

```bash
docker compose up -d
```

This spins up:
- **TimescaleDB** (PostgreSQL + time-series) on port `5432`
- **Redis** (cache + pub/sub) on port `6379`

## Environment Variables

Copy and fill in your `.env` at project root:

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

Most data source keys are optional for local dev. `DATABASE_URL`, `REDIS_URL`, and `VITE_CESIUM_ION_TOKEN` are required for core functionality.

## Running the Backend

```bash
cd services/api
go run cmd/server/main.go
```

WebSocket server starts on `localhost:8080`.

## Running the Frontend

```bash
cd packages/frontend
pnpm dev
```

Vite dev server starts on `localhost:5173`.

## Running Tests

```bash
# Go tests
cd services/api && go test ./...

# Frontend tests
cd packages/frontend && pnpm test
```
