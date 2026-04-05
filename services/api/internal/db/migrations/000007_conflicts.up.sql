-- Conflicts hypertable (ACLED armed conflict events)
CREATE TABLE IF NOT EXISTS conflicts (
    acled_id        TEXT             NOT NULL,
    position        GEOGRAPHY(POINT, 4326) NOT NULL,
    event_date      DATE             NOT NULL,
    event_type      TEXT             NOT NULL DEFAULT '',
    sub_event_type  TEXT             NOT NULL DEFAULT '',
    actor1          TEXT             NOT NULL DEFAULT '',
    actor2          TEXT             NOT NULL DEFAULT '',
    country         TEXT             NOT NULL DEFAULT '',
    admin1          TEXT             NOT NULL DEFAULT '',
    location        TEXT             NOT NULL DEFAULT '',
    fatalities      INTEGER          NOT NULL DEFAULT 0,
    notes           TEXT             NOT NULL DEFAULT '',
    source          TEXT             NOT NULL DEFAULT '',
    acled_timestamp TIMESTAMPTZ      NOT NULL,
    recorded_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('conflicts', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_conflicts_acled_id_time
    ON conflicts (acled_id, recorded_at DESC);
