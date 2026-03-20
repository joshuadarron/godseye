# Architecture

## System Overview

```mermaid
graph TB
  subgraph External["External Data Sources"]
    OpenSky["OpenSky Network<br/><i>ADS-B flights</i>"]
    CelesTrak["CelesTrak<br/><i>TLE orbital elements</i>"]
    AISHub["AISHub<br/><i>AIS vessel data</i>"]:::planned
    ACLED["ACLED<br/><i>Armed conflicts</i>"]:::planned
    GDELT["GDELT Project<br/><i>News & geopolitical</i>"]:::planned
    USGS["USGS<br/><i>Earthquakes</i>"]:::planned
    OWM["OpenWeatherMap<br/><i>Weather alerts</i>"]:::planned
    TM["Ticketmaster / PredictHQ<br/><i>Sports & concerts</i>"]:::planned
  end

  subgraph Go["Go Backend · :8080"]
    subgraph Workers["Ingestion Workers · goroutines"]
      FW["FlightWorker<br/><i>10s poll · OAuth2</i>"]
      SW["SatelliteWorker<br/><i>24h TLE fetch · 1s propagate</i>"]
      VW["VesselWorker"]:::planned
      EW["EventWorker"]:::planned
    end

    subgraph Broadcast["Broadcaster"]
      RedisSub["Redis Subscriber"]
      Fanout["Fan-out to clients"]
    end

    WS["WebSocket Server<br/><i>GET /ws</i>"]
    API["REST API<br/><i>/api/flights · /api/satellites</i>"]
  end

  subgraph Infra["Infrastructure · Docker Compose"]
    Redis[("Redis<br/><i>Pub/Sub · :6379</i>")]
    TSDB[("TimescaleDB + PostGIS<br/><i>:5432</i>")]
  end

  subgraph React["React Frontend · :5173"]
    WSHook["useWebSocket<br/><i>rAF message batching</i>"]

    subgraph Stores["Zustand Stores"]
      FS["useFlightStore"]
      SS["useSatelliteStore"]
    end

    subgraph Registry["Layer Registry"]
      FR["flights registration<br/><i>subtypes · icons · colors</i>"]
      SR["satellites registration<br/><i>subtypes · icons · colors</i>"]
    end

    subgraph Globe["CesiumJS Globe"]
      GEL["GenericEntityLayer"]
      ML["ModelLayer<br/><i>BillboardCollection</i>"]
      SPL["SatellitePropagationLayer<br/><i>client-side SGP4</i>"]

      subgraph Overlays["Selection Overlays"]
        FTO["FlightTrajectoryOverlay<br/><i>great-circle arc</i>"]
        SOO["SatelliteOrbitOverlay<br/><i>animated dash orbit</i>"]
        SFO["SatelliteFootprintOverlay<br/><i>ground visibility cone</i>"]
      end
    end

    subgraph HUD["HUD Panels"]
      FDP["FlightDetailPanel"]
      SDP["SatelliteDetailPanel"]
      FTT["FlightTooltip"]
      STT["SatelliteTooltip"]
      Sidebar["Sidebar<br/><i>layer toggles</i>"]
    end
  end

  %% External → Workers
  OpenSky --> FW
  CelesTrak --> SW
  AISHub -.-> VW
  ACLED -.-> EW
  GDELT -.-> EW
  USGS -.-> EW
  OWM -.-> EW
  TM -.-> EW

  %% Workers → Redis & DB
  FW -- "publish delta" --> Redis
  SW -- "publish delta" --> Redis
  FW -- "batch INSERT" --> TSDB
  SW -- "persist TLEs" --> TSDB

  %% Redis → Broadcaster → WebSocket
  Redis -- "subscribe 5 channels" --> RedisSub
  RedisSub --> Fanout
  Fanout --> WS

  %% REST API → DB
  API --> TSDB

  %% WebSocket → Frontend
  WS -- "JSON DeltaMessage" --> WSHook
  WSHook -- "processDeltas()" --> FS
  WSHook -- "processDeltas()" --> SS

  %% Stores → Registry → Globe
  FS --> FR
  SS --> SR
  FR --> GEL
  SR --> GEL
  GEL --> ML
  GEL --> SPL

  %% Selection → Overlays
  FR -. "on select" .-> FTO
  SR -. "on select" .-> SOO
  SR -. "on select" .-> SFO

  %% Registry → HUD
  FR -. "on select" .-> FDP
  FR -. "on hover" .-> FTT
  SR -. "on select" .-> SDP
  SR -. "on hover" .-> STT

  classDef planned fill:#1a1a2e,stroke:#555,stroke-dasharray:5 5,color:#888
```

## Data Flow

```mermaid
sequenceDiagram
  participant API as External API
  participant Worker as Go Worker
  participant DB as TimescaleDB
  participant Redis as Redis Pub/Sub
  participant BC as Broadcaster
  participant WS as WebSocket
  participant Hook as useWebSocket
  participant Store as Zustand Store
  participant Globe as CesiumJS Globe

  loop Every 10s (flights) / 24h (TLEs)
    Worker->>API: Poll for data
    API-->>Worker: Raw response
    Worker->>Worker: Parse & diff against previous snapshot
    Worker->>DB: Batch INSERT (ST_MakePoint)
    Worker->>Redis: PUBLISH channel:flights / channel:satellites
  end

  Redis->>BC: Message on subscribed channel
  BC->>BC: Fan-out to all registered clients
  BC->>WS: Write JSON DeltaMessage

  WS->>Hook: onmessage event
  Hook->>Hook: Buffer messages until rAF
  Hook->>Store: processDeltas(entities, "upsert" | "remove")
  Store->>Globe: React re-render triggers billboard updates

  Note over Globe: Incremental diff —<br/>only changed entities<br/>are added/removed/updated
```

## Database Schema

```mermaid
erDiagram
  flights {
    text icao24 "ICAO24 hex transponder code"
    text callsign "e.g. UAL123"
    text origin_country
    geography position "POINT(lng lat) · SRID 4326"
    float altitude "meters"
    float velocity "m/s"
    float heading "degrees"
    boolean on_ground
    text source "opensky | adsb"
    timestamptz recorded_at "hypertable partition key"
  }

  satellite_tles {
    integer norad_id "NORAD catalog number"
    text name "e.g. ISS (ZARYA)"
    text tle_line1
    text tle_line2
    timestamptz fetched_at "hypertable partition key"
  }
```

## WebSocket Message Format

```mermaid
classDiagram
  class DeltaMessage {
    +string layer
    +string action
    +Entity[] entities
  }
  class Entity {
    +string id
    +float lat
    +float lng
    +float heading
  }
  class Flight {
    +string callsign
    +string originCountry
    +float altitude
    +float velocity
    +boolean onGround
    +string source
  }
  class Satellite {
    +string name
    +float altitude
    +float velocity
    +int noradId
    +string tle1
    +string tle2
  }

  DeltaMessage --> Entity : contains
  Entity <|-- Flight
  Entity <|-- Satellite

  note for DeltaMessage "layer: 'flights' | 'satellites'\naction: 'upsert' | 'remove'"
```

## Frontend Component Tree

```mermaid
graph TD
  App["App"]
  Globe["Globe"]
  WSHook["useWebSocket()"]
  Viewer["Cesium Viewer"]
  ViewerInit["ViewerInit<br/><i>imagery · atmosphere</i>"]
  PickHandler["PickHandler<br/><i>hover & click detection</i>"]

  GEL_F["GenericEntityLayer<br/><i>flights</i>"]
  GEL_S["GenericEntityLayer<br/><i>satellites</i>"]

  ML["ModelLayer<br/><i>BillboardCollection</i>"]
  SPL["SatellitePropagationLayer<br/><i>SGP4 per-frame</i>"]

  SelOverlays["SelectedOverlays"]
  FTO["FlightTrajectoryOverlay"]
  SOO["SatelliteOrbitOverlay"]
  SFO["SatelliteFootprintOverlay"]

  Sidebar["Sidebar"]
  LayerGroup["LayerGroup<br/><i>per registered layer</i>"]
  SubtypeToggle["SubtypeToggle"]
  EntityCounter["EntityCounter"]

  FDP["FlightDetailPanel"]
  SDP["SatelliteDetailPanel"]
  FTT["FlightTooltip"]
  STT["SatelliteTooltip"]

  App --> Globe
  App --> Sidebar
  App --> FDP
  App --> SDP
  App --> FTT
  App --> STT

  Globe --> WSHook
  Globe --> Viewer
  Viewer --> ViewerInit
  Viewer --> PickHandler
  Viewer --> GEL_F
  Viewer --> GEL_S
  Viewer --> SelOverlays

  GEL_F --> ML
  GEL_S --> SPL

  SelOverlays --> FTO
  SelOverlays --> SOO
  SelOverlays --> SFO

  Sidebar --> LayerGroup
  LayerGroup --> SubtypeToggle
  LayerGroup --> EntityCounter
```

## Redis Channel Map

```mermaid
graph LR
  subgraph Channels["Redis Pub/Sub Channels"]
    CF["channel:flights"]
    CS["channel:satellites"]
    CV["channel:vessels"]:::planned
    CT["channel:trains"]:::planned
    CE["channel:events"]:::planned
  end

  FW["FlightWorker"] --> CF
  SW["SatelliteWorker"] --> CS
  VW["VesselWorker"]:::planned -.-> CV
  TW["TrainWorker"]:::planned -.-> CT
  EW["EventWorker"]:::planned -.-> CE

  CF --> BC["Broadcaster"]
  CS --> BC
  CV -.-> BC
  CT -.-> BC
  CE -.-> BC

  BC --> C1["Client 1"]
  BC --> C2["Client 2"]
  BC --> CN["Client N"]

  classDef planned fill:#1a1a2e,stroke:#555,stroke-dasharray:5 5,color:#888
```

---

_Dashed outlines indicate planned components not yet implemented._
