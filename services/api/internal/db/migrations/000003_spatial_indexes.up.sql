CREATE INDEX IF NOT EXISTS idx_flights_position ON flights USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_flights_recorded_at ON flights (recorded_at DESC);
