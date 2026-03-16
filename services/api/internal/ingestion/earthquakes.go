package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

const (
	usgsURL              = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.0&orderby=time&limit=500"
	earthquakePollInterval = 5 * time.Minute
	earthquakeRedisChannel = "channel:events"
)

// usgsFeatureCollection is the GeoJSON response from the USGS API.
type usgsFeatureCollection struct {
	Features []usgsFeature `json:"features"`
}

type usgsFeature struct {
	ID         string          `json:"id"`
	Properties usgsProperties `json:"properties"`
	Geometry   usgsGeometry   `json:"geometry"`
}

type usgsProperties struct {
	Mag    float64 `json:"mag"`
	Place  string  `json:"place"`
	Time   int64   `json:"time"`
	URL    string  `json:"url"`
	Alert  string  `json:"alert"`
	Tsunami int    `json:"tsunami"`
	Sig    int     `json:"sig"`
	MagType string `json:"magType"`
	Status string  `json:"status"`
}

type usgsGeometry struct {
	Coordinates [3]float64 `json:"coordinates"` // [lng, lat, depth]
}

// EarthquakeWorker polls the USGS Earthquake API and publishes event deltas.
type EarthquakeWorker struct {
	pool     *pgxpool.Pool
	rdb      *redis.Client
	client   *http.Client
	prev     map[string]models.EarthquakeEntity
	failures int
}

// NewEarthquakeWorker creates a new EarthquakeWorker.
func NewEarthquakeWorker(pool *pgxpool.Pool, rdb *redis.Client) *EarthquakeWorker {
	return &EarthquakeWorker{
		pool:   pool,
		rdb:    rdb,
		client: NewHTTPClient(30 * time.Second),
		prev:   make(map[string]models.EarthquakeEntity),
	}
}

func (w *EarthquakeWorker) Name() string { return "earthquakes" }

func (w *EarthquakeWorker) Start(ctx context.Context) error {
	ticker := time.NewTicker(earthquakePollInterval)
	defer ticker.Stop()

	// Fetch immediately on start, then every tick.
	w.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

func (w *EarthquakeWorker) tick(ctx context.Context) {
	entities, err := w.fetch(ctx)
	if err != nil {
		w.failures++
		backoff := Backoff(w.failures, time.Second, maxBackoffDuration)
		slog.Error("earthquake fetch failed", "error", err, "failures", w.failures, "backoff", backoff)
		select {
		case <-ctx.Done():
		case <-time.After(backoff):
		}
		return
	}

	w.failures = 0
	slog.Info("fetched earthquakes", "count", len(entities))

	// Build current state map.
	current := make(map[string]models.EarthquakeEntity, len(entities))
	for _, e := range entities {
		current[e.ID] = e
	}

	// Compute upserts: new or updated entities.
	var upserts []models.EarthquakeEntity
	for id, e := range current {
		old, existed := w.prev[id]
		if !existed || e.Magnitude != old.Magnitude || e.Status != old.Status || e.Alert != old.Alert {
			upserts = append(upserts, e)
		}
	}

	// Compute removals: entities in prev but not in current (expired from 24h window).
	var removes []models.EarthquakeEntity
	for id := range w.prev {
		if _, ok := current[id]; !ok {
			removes = append(removes, models.EarthquakeEntity{ID: id})
		}
	}

	w.prev = current

	// Publish upserts.
	if len(upserts) > 0 {
		anyEntities := make([]any, len(upserts))
		for i, e := range upserts {
			anyEntities[i] = e
		}
		if err := PublishDelta(ctx, w.rdb, earthquakeRedisChannel, "events", "upsert", anyEntities); err != nil {
			LogPublishError("events", err)
		}
	}

	// Publish removals.
	if len(removes) > 0 {
		anyEntities := make([]any, len(removes))
		for i, e := range removes {
			anyEntities[i] = e
		}
		if err := PublishDelta(ctx, w.rdb, earthquakeRedisChannel, "events", "remove", anyEntities); err != nil {
			LogPublishError("events", err)
		}
	}

	// Persist to database.
	w.persist(ctx, entities)
}

func (w *EarthquakeWorker) fetch(ctx context.Context) ([]models.EarthquakeEntity, error) {
	// Query last 24 hours.
	startTime := time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
	url := usgsURL + "&starttime=" + startTime

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var collection usgsFeatureCollection
	if err := json.Unmarshal(body, &collection); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	entities := make([]models.EarthquakeEntity, 0, len(collection.Features))
	for _, f := range collection.Features {
		lng := f.Geometry.Coordinates[0]
		lat := f.Geometry.Coordinates[1]
		depth := f.Geometry.Coordinates[2]

		if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
			continue
		}

		eventTime := time.UnixMilli(f.Properties.Time).UTC().Format(time.RFC3339)

		entities = append(entities, models.EarthquakeEntity{
			ID:           f.ID,
			Lat:          lat,
			Lng:          lng,
			Magnitude:    f.Properties.Mag,
			Place:        f.Properties.Place,
			Depth:        depth,
			Time:         eventTime,
			URL:          f.Properties.URL,
			Alert:        f.Properties.Alert,
			Tsunami:      f.Properties.Tsunami,
			Significance: f.Properties.Sig,
			MagType:      f.Properties.MagType,
			Status:       f.Properties.Status,
		})
	}

	return entities, nil
}

func (w *EarthquakeWorker) persist(ctx context.Context, entities []models.EarthquakeEntity) {
	if len(entities) == 0 {
		return
	}

	now := time.Now()
	const batchSize = 500
	for start := 0; start < len(entities); start += batchSize {
		end := start + batchSize
		if end > len(entities) {
			end = len(entities)
		}
		batch := entities[start:end]

		var sb strings.Builder
		sb.WriteString("INSERT INTO earthquakes (usgs_id, position, magnitude, place, depth, event_time, url, alert, tsunami, significance, mag_type, status, recorded_at) VALUES ")

		args := make([]interface{}, 0, len(batch)*14)
		for i, e := range batch {
			if i > 0 {
				sb.WriteString(",")
			}
			p := i * 14
			fmt.Fprintf(&sb, "($%d,ST_SetSRID(ST_MakePoint($%d,$%d),4326)::geography,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
				p+1, p+2, p+3, p+4, p+5, p+6, p+7, p+8, p+9, p+10, p+11, p+12, p+13, p+14)

			eventTime, _ := time.Parse(time.RFC3339, e.Time)
			args = append(args, e.ID, e.Lng, e.Lat, e.Magnitude, e.Place, e.Depth, eventTime, e.URL, e.Alert, e.Tsunami, e.Significance, e.MagType, e.Status, now)
		}

		_, err := w.pool.Exec(ctx, sb.String(), args...)
		if err != nil {
			slog.Error("earthquake persist error", "error", err)
		}
	}
}
