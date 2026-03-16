-- Vessels hypertable
CREATE TABLE IF NOT EXISTS vessels (
    mmsi         TEXT            NOT NULL,
    name         TEXT            NOT NULL DEFAULT '',
    callsign     TEXT            NOT NULL DEFAULT '',
    position     GEOGRAPHY(POINT, 4326) NOT NULL,
    speed        DOUBLE PRECISION NOT NULL DEFAULT 0,
    course       DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading      DOUBLE PRECISION NOT NULL DEFAULT 0,
    ship_type    INTEGER         NOT NULL DEFAULT 0,
    imo          INTEGER         NOT NULL DEFAULT 0,
    destination  TEXT            NOT NULL DEFAULT '',
    length       DOUBLE PRECISION NOT NULL DEFAULT 0,
    width        DOUBLE PRECISION NOT NULL DEFAULT 0,
    draught      DOUBLE PRECISION NOT NULL DEFAULT 0,
    nav_status   INTEGER         NOT NULL DEFAULT 15,
    recorded_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('vessels', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_vessels_mmsi_time
    ON vessels (mmsi, recorded_at DESC);
