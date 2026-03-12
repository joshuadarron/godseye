package ingestion

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joshuaferrara/go-satellite"
	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

const (
	celestrakURL          = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
	satelliteRedisChannel = "channel:satellites"
	propagateInterval     = 1 * time.Second
	tleRefreshInterval    = 24 * time.Hour
	satelliteBatchSize    = 2000
)

// tleRecord holds a parsed TLE along with the go-satellite object.
type tleRecord struct {
	name    string
	line1   string
	line2   string
	noradID int
	sat     satellite.Satellite
}

// SatelliteWorker propagates satellite positions from TLE data using SGP4.
type SatelliteWorker struct {
	pool *pgxpool.Pool
	rdb  *redis.Client

	sats []tleRecord
}

// NewSatelliteWorker creates a new SatelliteWorker.
func NewSatelliteWorker(pool *pgxpool.Pool, rdb *redis.Client) *SatelliteWorker {
	return &SatelliteWorker{
		pool: pool,
		rdb:  rdb,
	}
}

func (w *SatelliteWorker) Name() string { return "satellites" }

func (w *SatelliteWorker) Start(ctx context.Context) error {
	// Initial TLE fetch.
	if err := w.fetchTLEs(ctx); err != nil {
		slog.Error("initial TLE fetch failed", "error", err)
		// Continue anyway — will retry on next refresh cycle.
	}

	propagateTicker := time.NewTicker(propagateInterval)
	defer propagateTicker.Stop()

	refreshTicker := time.NewTicker(tleRefreshInterval)
	defer refreshTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-propagateTicker.C:
			w.propagateAndPublish(ctx)
		case <-refreshTicker.C:
			if err := w.fetchTLEs(ctx); err != nil {
				slog.Error("TLE refresh failed", "error", err)
			}
		}
	}
}

func (w *SatelliteWorker) fetchTLEs(ctx context.Context) error {
	slog.Info("fetching TLEs from CelesTrak")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, celestrakURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	records, err := parseTLEStream(resp.Body)
	if err != nil {
		return fmt.Errorf("parse TLEs: %w", err)
	}

	w.sats = records
	slog.Info("loaded TLEs", "count", len(records))

	// Persist to database.
	w.persistTLEs(ctx, records)

	return nil
}

// parseTLEStream reads 3-line TLE format: name, line1, line2 repeating.
func parseTLEStream(r io.Reader) ([]tleRecord, error) {
	scanner := bufio.NewScanner(r)
	var records []tleRecord

	for {
		// Read name line.
		if !scanner.Scan() {
			break
		}
		name := strings.TrimSpace(scanner.Text())
		if name == "" {
			continue
		}

		// Read line 1.
		if !scanner.Scan() {
			break
		}
		line1 := strings.TrimSpace(scanner.Text())

		// Read line 2.
		if !scanner.Scan() {
			break
		}
		line2 := strings.TrimSpace(scanner.Text())

		if !strings.HasPrefix(line1, "1 ") || !strings.HasPrefix(line2, "2 ") {
			continue
		}

		// Parse NORAD ID from line 1 (columns 3-7).
		noradStr := strings.TrimSpace(line1[2:7])
		noradID, err := strconv.Atoi(noradStr)
		if err != nil {
			continue
		}

		// Initialize go-satellite object.
		sat := satellite.TLEToSat(line1, line2, satellite.GravityWGS84)

		records = append(records, tleRecord{
			name:    name,
			line1:   line1,
			line2:   line2,
			noradID: noradID,
			sat:     sat,
		})
	}

	return records, scanner.Err()
}

func (w *SatelliteWorker) propagateAndPublish(ctx context.Context) {
	if len(w.sats) == 0 {
		return
	}

	now := time.Now().UTC()
	year, month, day := now.Date()
	hour, min, sec := now.Clock()
	msec := now.Nanosecond() / 1e6

	entities := make([]models.SatelliteEntity, 0, len(w.sats))

	for i := range w.sats {
		rec := &w.sats[i]

		// Propagate position using SGP4.
		position, velocity := satellite.Propagate(rec.sat, year, int(month), day, hour, min, sec)

		// Check for NaN (satellite may have decayed or TLE is invalid).
		if math.IsNaN(position.X) || math.IsNaN(position.Y) || math.IsNaN(position.Z) {
			continue
		}

		// Convert ECI to geodetic (lat/lng/alt).
		gmst := satellite.GSTimeFromDate(year, int(month), day, hour, min, sec)
		alt, _, latLngRad := satellite.ECIToLLA(position, gmst)
		latLngDeg := satellite.LatLongDeg(latLngRad)

		lat := latLngDeg.Latitude
		lng := latLngDeg.Longitude

		// Clamp values.
		if lat > 90 || lat < -90 || lng > 180 || lng < -180 {
			continue
		}

		// Compute velocity magnitude in km/s.
		vel := math.Sqrt(velocity.X*velocity.X + velocity.Y*velocity.Y + velocity.Z*velocity.Z)

		_ = msec // available if needed for sub-second precision

		entities = append(entities, models.SatelliteEntity{
			ID:       strconv.Itoa(rec.noradID),
			Name:     rec.name,
			Lat:      lat,
			Lng:      lng,
			Altitude: alt,
			Velocity: vel,
			NoradID:  rec.noradID,
		})
	}

	// Publish in batches to keep WebSocket message sizes reasonable.
	for i := 0; i < len(entities); i += satelliteBatchSize {
		end := i + satelliteBatchSize
		if end > len(entities) {
			end = len(entities)
		}
		batch := entities[i:end]

		anyEntities := make([]any, len(batch))
		for j, e := range batch {
			anyEntities[j] = e
		}

		msg := models.DeltaMessage{
			Layer:    "satellites",
			Action:   "upsert",
			Entities: anyEntities,
		}

		data, err := json.Marshal(msg)
		if err != nil {
			slog.Error("satellite marshal error", "error", err)
			continue
		}

		if err := w.rdb.Publish(ctx, satelliteRedisChannel, data).Err(); err != nil {
			slog.Error("satellite publish error", "error", err)
		}
	}
}

func (w *SatelliteWorker) persistTLEs(ctx context.Context, records []tleRecord) {
	if len(records) == 0 {
		return
	}

	now := time.Now()
	rows := make([][]interface{}, len(records))
	for i, rec := range records {
		rows[i] = []interface{}{
			rec.noradID,
			rec.name,
			rec.line1,
			rec.line2,
			now,
		}
	}

	_, err := w.pool.CopyFrom(ctx,
		pgx.Identifier{"satellite_tles"},
		[]string{"norad_id", "name", "tle_line1", "tle_line2", "fetched_at"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		slog.Error("satellite TLE persist error", "error", err)
	}
}
