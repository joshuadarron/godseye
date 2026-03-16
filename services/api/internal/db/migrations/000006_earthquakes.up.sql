-- Earthquakes hypertable
CREATE TABLE IF NOT EXISTS earthquakes (
    usgs_id       TEXT             NOT NULL,
    position      GEOGRAPHY(POINT, 4326) NOT NULL,
    magnitude     DOUBLE PRECISION NOT NULL DEFAULT 0,
    place         TEXT             NOT NULL DEFAULT '',
    depth         DOUBLE PRECISION NOT NULL DEFAULT 0,
    event_time    TIMESTAMPTZ      NOT NULL,
    url           TEXT             NOT NULL DEFAULT '',
    alert         TEXT             NOT NULL DEFAULT '',
    tsunami       INTEGER          NOT NULL DEFAULT 0,
    significance  INTEGER          NOT NULL DEFAULT 0,
    mag_type      TEXT             NOT NULL DEFAULT '',
    status        TEXT             NOT NULL DEFAULT '',
    recorded_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('earthquakes', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_earthquakes_usgs_id_time
    ON earthquakes (usgs_id, recorded_at DESC);
