# Plan: cleanup, compliance, first run, retention, agent layer

Working plan for the godseye cleanup and build-out. One branch and one PR per
phase. At the end of each phase, open the PR, post a summary, and stop. Do not
start the next phase until Joshua says so.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done.

Context: the repo is getting outside traffic because its name overlaps with the
viral "God's Eye View" project. This plan fixes what new visitors hit first,
cleans up imagery licensing, adds a one-command dev setup, improves repo
presentation, adds data retention, and (behind a gate) builds a
natural-language query layer on RocketRide.

---

## Ground rules

- Read `.claude/CLAUDE.md` and `ARCHITECTURE.md` before changing code. Follow
  existing patterns: one ingestion worker per source, the layer registry in
  `packages/frontend/src/registries/`, Redis for pub/sub only, and the API
  service as the only database reader.
- Branch names: `chore/phase-1-cleanup`, `fix/phase-2-imagery-compliance`, and
  so on.
- Commit using `.claude/commands/commit.md`: tag prefix, capitalized sentence,
  trailing period, no `Co-Authored-By`, files staged explicitly.
- Do not rewrite git history.
- Quality gate before every commit:
  `pnpm lint && pnpm format && pnpm typecheck && pnpm test`, plus
  `go vet ./services/... && go test ./services/...`.
- Every service keeps a single config module as the only reader of environment
  variables. No scattered `os.Getenv` or `import.meta.env` calls.
- Prose (README, docs, PR descriptions, issue bodies) is technical and
  builder-to-builder. No marketing language. No em-dashes.
- Never state legal conclusions about data licenses or terms of service. Link
  the terms and mark the item for Joshua's review.
- Items marked **[Joshua]** are human-only. Items marked **[gh, ask first]** may
  be run with the `gh` CLI only after Joshua approves the exact command.
- Minimal first. Build the smallest version that meets the acceptance criteria,
  then stop.

---

## Blockers and corrections

Findings from the read-only survey on 2026-09-16, before any code change.

### B1. Git identity is wrong (blocks the first commit)

`git config user.email` returns `j.dspears@yahoo.com`. The required value is
`27755126+joshuadarron@users.noreply.github.com`. **[Joshua]** set it before
Phase 1 commits:

```
git config --global user.email 27755126+joshuadarron@users.noreply.github.com
```

Also enable, in GitHub Settings then Emails, "Keep my email addresses private"
and "Block command line pushes that expose my email."

### B2. Phase 2.1 scope is larger than the handoff states

The handoff lists four `import.meta.env` call sites. There are nine reads across
six files:

| File                                                  | Line   | Variable                      |
| ----------------------------------------------------- | ------ | ----------------------------- |
| `packages/frontend/src/api/auth.ts`                   | 3      | `VITE_AUTH_URL`               |
| `packages/frontend/src/api/client.ts`                 | 3      | `VITE_AUTH_URL`               |
| `packages/frontend/src/components/Auth/LoginPage.tsx` | 5      | `VITE_AUTH_URL`               |
| `packages/frontend/src/components/Globe/Globe.tsx`    | 29     | `VITE_CESIUM_ION_TOKEN`       |
| `packages/frontend/src/hooks/useEncounters.ts`        | 9, 14  | `VITE_API_URL`, `VITE_WS_URL` |
| `packages/frontend/src/hooks/useNearby.ts`            | 13, 17 | `VITE_API_URL`, `VITE_WS_URL` |
| `packages/frontend/src/hooks/useWebSocket.ts`         | 103    | `VITE_WS_URL`                 |

`VITE_API_URL` is undocumented. It is absent from the env var list in
`.claude/CLAUDE.md`. Phase 1.3 adds it there and Phase 2.1 covers it in
`config.ts`; confirm it is in `packages/frontend/.env.example` too.

### B3. Confirmed premises

- `joshuaferrara/godseye` appears in 28 files.
- `github.com/joshuaferrara/go-satellite` is a real dependency at
  `services/api/go.mod:9` and must survive the rename.
- `services/collector` contains only `cmd/` and `go.mod`, and is listed in
  `go.work`.
- `Globe.tsx:45` loads `https://mt1.google.com/vt/...`; `Globe.tsx:54` hides the
  credit container.
- `mise.toml` lines 7 and 22 reference `bootstrap.sh` and `bootstrap.ps1`, which
  do not exist.
- `scripts/lib/` has all seven helpers: `color`, `docker`, `env`, `log`, `net`,
  `platform`, `proc`.
- `.dev/` is already gitignored (`.gitignore:7`), so Phase 4.3 needs no change
  there.
- Migrations stop at `000007_conflicts`, so `000008_compression` is free.

---

## Joshua's checklist (not for Claude Code)

- **Before Phase 1:** fix the git identity (B1). Screenshot Insights then
  Traffic as a baseline.
- **After Phase 2:** review every "needs review" row in `DATA_SOURCES.md`, ACLED
  and OpenSky first. Decide whether a hosted demo is on the table.
- **After Phase 4 merges:** approve the `gh` commands; record a 15 to 20 second
  GIF using the new imagery (never the old Google tiles) and save it to
  `docs/media/demo.gif` under 10MB; upload a 1280x640 social preview in Settings
  then General; approve the good-first-issue drafts; tag `v0.1.0`.
- **Posts:** post 1 goes out after Phase 4 using `.dev/content/post-1-facts.md`,
  post 2 after Phase 7. Hashnode is canonical, cross-posted to Medium and
  Dev.to.

---

## Phase 1: Cleanup

Branch `chore/phase-1-cleanup`.

Why: the Go module path uses the wrong GitHub owner (`joshuaferrara`, inherited
from the `github.com/joshuaferrara/go-satellite` dependency during
scaffolding). The README clone command 404s. `services/collector` is an empty
placeholder. Several docs are stale.

- [ ] **1.1 Fix the module path.**

  ```bash
  grep -rl --exclude-dir={.git,node_modules} 'joshuaferrara/godseye' . \
    | xargs sed -i 's#joshuaferrara/godseye#joshuadarron/godseye#g'
  (cd services/api && go mod tidy) && (cd services/auth && go mod tidy)
  go work sync && go build ./services/... && go test ./services/...
  ```

  Run from Git Bash or WSL on Windows. The pattern must not touch
  `github.com/joshuaferrara/go-satellite`.

  Acceptance: `grep -r 'joshuaferrara/godseye' --exclude-dir=.git .` returns
  nothing, `joshuaferrara/go-satellite` still appears in `services/api/go.mod`,
  and the build and tests pass.

- [ ] **1.2 Remove the collector stub.** Delete `services/collector`, then
      remove it from `go.work`, the `go vet` and `go test` lines in
      `.github/workflows/ci.yml`, the project trees in `.claude/CLAUDE.md` and
      `ARCHITECTURE.md`, and any README mention.

  Acceptance: CI config references only `services/api` and `services/auth`.

- [ ] **1.3 Fix stale docs.**
  - `.claude/CLAUDE.md`: add a Key Conventions line, "Go module paths are
    `github.com/joshuadarron/godseye/services/<name>`. Never derive the repo
    owner from a dependency path." Correct the Gotchas line claiming a Cesium
    Ion token is required; `Globe.tsx` only sets it when present. Add
    `VITE_API_URL` to the frontend env var list (see B2).
  - `README.md` prerequisites: Node 22, not 18. Vite 7 needs
    `^20.19.0 || >=22.12.0`, and `mise.toml` and CI pin 22.
  - `CONTRIBUTING.md`: it links a `SETUP.md` that was merged into the README, so
    point it at the README setup section. Its commit convention (lowercase
    conventional commits) conflicts with `.claude/commands/commit.md`. Align it
    with `commit.md` and call this out in the PR description so Joshua can
    override.

---

## Phase 2: Imagery compliance and attribution

Branch `fix/phase-2-imagery-compliance`.

Why: `Globe.tsx` loads imagery from
`https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`, Google's internal tile
endpoint rather than Maps Platform. It also hides Cesium's credit container.
Both need to go before any GIF, hosted demo, or post.

- [ ] **2.1 Centralize frontend config.** Create
      `packages/frontend/src/config.ts` as the only reader of `import.meta.env`.
      Export a typed, frozen config object and update all nine call sites in B2.

  Acceptance: `grep -rn "import.meta.env" packages/frontend/src` matches only
  `config.ts`.

- [ ] **2.2 Tiered imagery provider.** Add
      `packages/frontend/src/utils/imagery.ts` with a pure
      `resolveImageryTier(config)` returning `'default' | 'ion' | 'google3d'`, plus a
      function that applies the tier to a viewer.

  | Tier       | Condition                      | What loads                                                                                                                                     |
  | ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
  | `default`  | No keys                        | Cesium's bundled NaturalEarthII via `TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII'))`. Keyless.        |
  | `ion`      | `VITE_CESIUM_ION_TOKEN` set    | Ion world imagery and world terrain                                                                                                            |
  | `google3d` | `VITE_GOOGLE_MAPS_API_KEY` set | Google Photorealistic 3D Tiles through the official Cesium integration (`createGooglePhotorealistic3DTileset` with `GoogleMaps.defaultApiKey`) |

  Notes: verify every Cesium API name against the installed `cesium` version
  before using it. Confirm Vite serves Cesium's `Assets/` directory so
  NaturalEarthII loads. Check the `<Viewer>` props in `Globe.tsx`; the commit
  "Resolve missing globe by removing async base layer" changed how the base
  layer attaches, so follow whatever pattern that fix settled on. Delete the
  `mt1.google.com` provider and the code setting the credit container to
  `display: none`. Add `VITE_GOOGLE_MAPS_API_KEY=` to
  `packages/frontend/.env.example` with a comment linking Map Tiles API setup.

  Tests: unit-test `resolveImageryTier` across the key combinations. When both
  keys are set, choose `google3d`.

  Acceptance: with an empty frontend `.env`, the globe renders with
  NaturalEarthII and visible credits, and no request goes to `mt1.google.com`.

- [ ] **2.3 In-app data attribution.** Add an optional
      `attribution: { label: string; url: string }` field to the layer registry
      entries in `src/registries/`. Render a small "Sources" control in the HUD
      listing attributions for currently visible layers. Fill it in for OpenSky,
      CelesTrak, AISStream, USGS, and ACLED.

- [ ] **2.4 `DATA_SOURCES.md`.** Create it at the repo root, one table row per
      source, with columns: Source, Used for, Key required, Env var, Attribution
      requirement, Terms URL, Redistribution notes (factual, no legal conclusions),
      Status (`needs review` or `ok`).

  Cover: OpenSky live states; the OpenSky aircraft metadata database
  (`scripts/build-aircraft-db.mjs`); CelesTrak; AISStream; USGS; ACLED; Cesium
  ion; Google Map Tiles API; NaturalEarthII; every static file in
  `packages/frontend/public/data/` (`airports.json`, `routes.json`,
  `icao-types.json`), finding origins with `git log --follow -- <path>` and
  writing `UNKNOWN` where undeterminable; and aircraft icons (see commit "Add
  FlightAware aircraft icon classification system"), determining whether any
  icon assets came from a third party.

  Mark every row `needs review`. Add a sentence noting that the API persists
  ACLED and OpenSky data and re-serves it over REST.

- [ ] **2.5 README notices.** Add a short "Notices" section: an independence
      line stating godseye is an independent project started in March 2026 and not
      affiliated with God's Eye View, linking
      `https://github.com/bilawalsidhu/gods-eye-view`, neutral and respectful; a
      disclaimer that data may be delayed, incomplete, or wrong and that godseye is
      not for navigation, emergency response, or other operational use; and a
      pointer to `DATA_SOURCES.md`.

---

## Phase 3: One-command first run

Why: first run currently means three terminals, manual `.env` copies, and a
hand-generated `JWT_SECRET`. `mise.toml` also references `bootstrap.sh` and
`bootstrap.ps1`, which do not exist. `scripts/lib/` already contains the
cross-platform helpers built for this.

- [ ] **3.1 `scripts/dev.mjs` and root `pnpm dev`.** One cross-platform Node
      script, built on `scripts/lib`, running in order:
  1. Check tool versions for Go 1.25, Node 22, and Docker, printing remediation
     for anything missing (point at `mise install`).
  2. Copy any missing `.env.example` to `.env` for `services/api`,
     `services/auth`, and `packages/frontend`. Never overwrite an existing
     `.env`.
  3. If `JWT_SECRET` is empty in either service `.env`, generate 32 random bytes
     as hex and write the same value to both. If both already have different
     non-empty values, stop and say so.
  4. Run `docker compose up -d --wait --wait-timeout 120 timescaledb redis`.
     Start `memgraph` without waiting on it.
  5. Spawn `go run ./cmd/server` in `services/api` and `services/auth`, and
     `pnpm dev` in `packages/frontend`, with color-prefixed log lines.
  6. On Ctrl+C, stop all children cleanly on macOS, Linux, and Windows. Leave
     Docker containers running.

  Add `"dev": "node scripts/dev.mjs"` to the root `package.json`. Update the
  `mise.toml` header comment (lines 7 and 22) to reference `pnpm dev` instead of
  the bootstrap scripts.

  Acceptance: on a clean clone with Docker running, `pnpm install && pnpm dev`
  produces a working globe at `http://localhost:5173` with no manual steps.

- [ ] **3.2 Anonymous OpenSky fallback.** In the flight worker, when
      `OPENSKY_CLIENT_ID` or `OPENSKY_CLIENT_SECRET` is empty, call the states
      endpoint without a bearer token instead of disabling the layer. Read OpenSky's
      current documentation for anonymous credit limits and credit cost per request.
      Compute a poll interval that keeps a full day of polling inside the anonymous
      limit, and apply it through config (`OPENSKY_ANON_POLL_INTERVAL`, defaulting
      to the computed value). Log the mode and interval at startup. Keep the
      existing exponential backoff.

  Tests: unit-test mode selection and the interval math.

- [ ] **3.3 `GET /api/sources`.** Add `services/api/internal/api/sources.go`.
      Build its response from the config struct only, never from new env reads:

  ```json
  [
    {
      "layer": "flights",
      "enabled": true,
      "mode": "anonymous",
      "reason": "",
      "signupUrl": "https://opensky-network.org/"
    },
    {
      "layer": "vessels",
      "enabled": false,
      "mode": "",
      "reason": "AISSTREAM_API_KEY not set",
      "signupUrl": "https://aisstream.io/"
    }
  ]
  ```

  On the frontend, fetch it once at startup into a small store. `LayerTab` shows
  a locked state for disabled layers, with the reason and a signup link, instead
  of an empty layer.

  Tests: Go handler test across config permutations, plus a frontend store test.

- [ ] **3.4 README Quick Start.** The primary Quick Start becomes clone,
      `pnpm install`, `pnpm dev`. Move the existing per-service steps into a "Manual
      setup" section. List exactly which layers work with zero keys (satellites,
      earthquakes, and flights in anonymous mode) and which keys unlock the rest.

- [ ] **3.5 CI smoke job.** Add a `smoke` job to `.github/workflows/ci.yml` that
      starts TimescaleDB and Redis as job services, runs the API with only
      `DATABASE_URL`, `REDIS_URL`, and a generated `JWT_SECRET`, waits for
      `/healthz`, then opens the WebSocket using Node 22's global `WebSocket` and
      asserts a `satellites` delta arrives within 30 seconds. Before writing the
      client, read `services/api/internal/ws/handler.go` and `useViewportBounds.ts`,
      and send whatever initial viewport or subscription message the real client
      sends. If CelesTrak availability makes the job flaky, propose a TLE fixture in
      the PR description instead of silently retrying.

---

## Phase 4: Repo presentation

- [ ] **4.1 README structure.** Reorder top to bottom: one-line description; GIF
      placeholder `docs/media/demo.gif` with an HTML comment
      `<!-- TODO(Joshua): record after Phase 2 imagery change -->`; Quick Start;
      Data Layers table; a "How it's built" section of 120 words or less covering
      server-side ingestion done once regardless of client count, Redis fan-out,
      position history in TimescaleDB hypertables, and proximity and encounters as
      Memgraph queries, linking `ARCHITECTURE.md` for the rest; Notices; Setup
      details; Contributing and License.

- [ ] **4.2 Issue templates.** Add under `.github/ISSUE_TEMPLATE/`: `bug.yml`
      with fields for OS, Go and Node versions, which layers, and steps to
      reproduce; `data-source.yml` with fields for source name, URL, key required,
      update cadence, and terms link; `config.yml` routing questions to Discussions.

- [ ] **4.3 Good first issue drafts.** Write `.dev/content/good-first-issues.md`
      (`.dev/` is already gitignored) with draft issues for a GDELT events layer
      following the conflicts worker pattern, a ReliefWeb layer, and a trains layer
      scoped to one GTFS-realtime feed first. Each draft lists the files to touch,
      following the existing worker, model, migration, registry, and panel pattern,
      plus acceptance criteria. **[gh, ask first]** create them with the
      `good first issue` label.

- [ ] **4.4 Repo metadata commands.** **[gh, ask first]** Prepare for approval,
      do not run unapproved:

  ```bash
  gh repo edit joshuadarron/godseye \
    --description "Real-time flights, vessels, satellites, earthquakes, and armed conflicts on a 3D CesiumJS globe. Go ingestion, TimescaleDB history, Memgraph encounter graph." \
    --enable-discussions \
    --add-topic osint,geospatial,cesiumjs,3d-globe,flight-tracking,adsb,ais,vessel-tracking,satellite-tracking,sgp4,timescaledb,postgis,memgraph,golang,react,websocket,real-time,situational-awareness
  ```

---

## Phase 5: Fact sheet for post 1

- [ ] Do not write the post. Write `.dev/content/post-1-facts.md` (not
      committed) so Joshua can verify every claim against a commit. It contains:
  - **Timeline.** First commit date, when each layer went live, and when auth,
    tests, and CI landed, each with a short SHA.
  - **Architecture claims.** Each with the file path and SHA that proves it:
    worker cadences, Redis fan-out, hypertable schema, Memgraph proximity and
    encounter queries.
  - **The module path story.** The commit that introduced
    `joshuaferrara/godseye`, how many files it reached (28 as of this survey),
    the `go-satellite` dependency it was inherited from, and the Phase 1 fix
    SHA.
  - **Numbers.** Go and TypeScript line counts (excluding generated files and
    lockfiles), test counts, and layer count.

---

## Phase 6: Retention, compression, and hosted-demo artifacts

- [ ] **6.1 Retention and compression.** No hypertable has a retention or
      compression policy today.

  Migration: add `000008_compression` (up and down) in
  `services/api/internal/db/migrations/`. Confirm first that the migration
  runner can execute these statements, transaction behavior in particular.

  ```sql
  ALTER TABLE flights SET (timescaledb.compress, timescaledb.compress_segmentby = 'icao24');
  ALTER TABLE vessels SET (timescaledb.compress, timescaledb.compress_segmentby = 'mmsi');
  ```

  Policies from config, applied at startup in the `db` package, sourced from
  config rather than hardcoded SQL:

  | Config key                 | Default   | Applies to       |
  | -------------------------- | --------- | ---------------- |
  | `COMPRESS_AFTER`           | `1 day`   | flights, vessels |
  | `RETENTION_FLIGHTS`        | `14 days` | flights          |
  | `RETENTION_VESSELS`        | `14 days` | vessels          |
  | `RETENTION_SATELLITE_TLES` | `30 days` | satellite_tles   |

  Leave earthquakes and conflicts without retention. Use
  `if_not_exists => true`. When a configured retention differs from the existing
  job's `drop_after`, remove the policy and re-add it.

  Tests: behind `TEST_DATABASE_URL`, assert the expected jobs exist in
  `timescaledb_information.jobs` with the configured intervals.

- [ ] **6.2 Hosted demo artifacts.** Gate: only if Joshua confirms the Phase 2
      terms review is done. Build artifacts only, do not deploy anywhere.
      Multi-stage Dockerfiles for `services/api` and `services/auth` with minimal
      runtime images; a frontend production build served by Caddy, reverse-proxying
      `/ws`, `/api`, and `/auth`; a `docker compose --profile app` profile running
      the full stack; a read-only mode flag in config that disables registration and
      only allows viewing; and a one-page `docs/deploy.md` covering single-VM
      deployment and setting spend caps on every keyed provider.

---

## Phase 7: Natural-language query layer on RocketRide

Gate: wait for Joshua's go-ahead.

Goal: ask questions about current and historical positions, proximity, and
encounters, and have the globe respond. The layer is optional: with
`VITE_AGENT_URL` unset, godseye behaves exactly as it does today.

Note: the `rocketride` MCP server failed to connect in the 2026-09-16 session
(`CONNECTION_CLOSED`). Confirm it is reachable before starting 7.0.

- [ ] **7.0 Research and design, then stop.** Read the RocketRide docs at
      `https://docs.rocketride.org` and the TypeScript SDK documentation in
      `github.com/rocketride-org/rocketride-server`. Pipelines are JSON; SDKs
      connect over WebSocket on port 5565. Determine which tool-call mechanism the
      runtime supports today (HTTP tools, MCP, or other) and whether it has native
      HTTP ingress. Never invent node names, pipeline fields, or SDK methods; cite
      the doc page or source file for each one used. Write `docs/agent-design.md`
      covering the pipeline shape, the tool list with request and response schemas,
      whether a gateway service is needed, the auth flow, rate limiting, and failure
      behavior. Open a draft PR with only the design doc and stop.

- [ ] **7.1 Query endpoints in the Go API.** Add these in the existing
      repository and handler layers. Tools only ever call the REST API and never
      touch the database.
  - `GET /api/query/positions?layer=&bbox=&from=&to=&limit=`
  - Time-window and bbox filters on `GET /api/graph/encounters`
  - `GET /api/entities/search?q=`, matching callsign, ICAO24, MMSI, or NORAD ID

  Validate every parameter. Enforce `QUERY_MAX_ROWS` and `QUERY_MAX_WINDOW` from
  config. Every hypertable query includes time bounds, per CLAUDE.md.

  Tests: handler and repository tests, database-backed ones behind
  `TEST_DATABASE_URL`.

- [ ] **7.2 Privacy guardrails.** The frontend aircraft lookup includes an
      `owner` field. Tool responses must never include owner or operator-person
      data, and the agent must not receive `aircraft.json`. The system prompt
      declines person-targeted questions (for example, "where is [person]'s jet");
      tracking assets is in scope, tracking named individuals is out of scope. Add
      eval cases asserting both refusals.

- [ ] **7.3 Agent gateway.** Only if 7.0 shows one is needed. Create
      `services/agent` in TypeScript and add it to `pnpm-workspace.yaml`, with
      `src/config.ts` as the single env reader, `POST /ask` streaming over SSE, JWT
      verification using the shared `JWT_SECRET`, per-user rate limiting, and the
      RocketRide TS SDK client. Tests live in `services/agent/tests/`, mirroring
      `src/`.

- [ ] **7.4 Globe actions.** Define the action schema with zod in
      `packages/shared`:

  ```ts
  type GlobeAction =
    | { type: 'flyTo'; lat: number; lon: number; altitudeM: number }
    | { type: 'select'; layer: LayerId; id: string }
    | { type: 'setLayers'; visible: LayerId[] }
    | { type: 'showTracks'; layer: LayerId; ids: string[]; from: string; to: string }
  ```

  Frontend: an executor that validates every action with zod, then executes it
  through `utils/viewerRef.ts`, `selectedEntityStore`, and
  `layerVisibilityStore`, silently dropping invalid actions and logging them in
  dev; a `HistoryOverlay` in `components/Globe/` rendering `showTracks` results
  from the `/history` and `/api/query/positions` endpoints; and a chat panel in
  `components/HUD/` built on `useDraggablePanel`, streaming responses and
  showing each tool call inline.

- [ ] **7.5 Eval harness.** `services/agent/evals/questions.yaml` with about 20
      questions, each with the expected tool calls and parameter constraints, plus
      expected refusals for the privacy cases. Include vessel encounters in a named
      strait over the last 24 hours; M5+ earthquakes this week within 100 km of
      ACLED events; flights currently near a named airport; and a satellite pass
      question. Add a script that creates a pg_dump snapshot fixture from a local
      database (do not commit large dumps; document how to regenerate) and a runner
      that replays the questions and reports tool-call pass or fail.

- [ ] **7.6 AIS gap detection.** Follow-on, only after evals pass. Add a query
      for vessels that went dark: the last AIS message is older than
      `GAP_THRESHOLD`, the prior 6 hours showed regular reporting, and the vessel is
      not stationary near a port (use `airports.json`-style static data only if a
      port dataset with clear terms exists, otherwise flag it in the PR). Expose it
      as a tool plus an optional HUD filter.

- [ ] **7.7 Runtime issues.** If RocketRide runtime or SDK behavior blocks the
      work or looks wrong, do not work around it silently. Write a minimal
      reproduction to `.dev/rocketride-issues.md` (version, pipeline JSON, expected,
      actual) so Joshua can file it upstream.

---

## Phase 8: Fact sheet for post 2

- [ ] Write `.dev/content/post-2-facts.md` (not committed) with the final tool
      list and schemas, the action schema, guardrail design and the refusal eval
      results, the eval pass rate, one end-to-end transcript of a question producing
      a `flyTo` plus `showTracks`, and any upstream RocketRide issues filed. Every
      claim gets a file path and SHA.

---

## PR description template (every phase)

```
## Summary
What changed and why, in a few sentences.

## Verification
Commands run and their results (lint, typecheck, tests, manual checks).

## Needs Joshua
Decisions, reviews, or [gh, ask first] commands awaiting approval.
```
