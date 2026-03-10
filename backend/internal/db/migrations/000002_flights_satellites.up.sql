-- Flights hypertable
CREATE TABLE IF NOT EXISTS flights (
    icao24       TEXT        NOT NULL,
    callsign     TEXT        NOT NULL DEFAULT '',
    origin_country TEXT      NOT NULL DEFAULT '',
    position     GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude     DOUBLE PRECISION NOT NULL DEFAULT 0,
    velocity     DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading      DOUBLE PRECISION NOT NULL DEFAULT 0,
    on_ground    BOOLEAN     NOT NULL DEFAULT FALSE,
    source       TEXT        NOT NULL DEFAULT 'opensky',
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('flights', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_flights_icao24_time
    ON flights (icao24, recorded_at DESC);

-- Satellite TLEs hypertable
CREATE TABLE IF NOT EXISTS satellite_tles (
    norad_id   INTEGER     NOT NULL,
    name       TEXT        NOT NULL DEFAULT '',
    tle_line1  TEXT        NOT NULL,
    tle_line2  TEXT        NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('satellite_tles', 'fetched_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_satellite_tles_norad_time
    ON satellite_tles (norad_id, fetched_at DESC);
