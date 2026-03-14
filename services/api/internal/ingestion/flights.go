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

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

const (
	openSkyURL         = "https://opensky-network.org/api/states/all"
	flightPollInterval = 10 * time.Second
	flightRedisChannel = "channel:flights"
	maxBackoffDuration = 5 * time.Minute
)

// FlightWorker polls the OpenSky Network API and publishes flight deltas.
type FlightWorker struct {
	pool     *pgxpool.Pool
	rdb      *redis.Client
	username string
	password string
	client   *http.Client

	prev     map[string]models.FlightEntity
	failures int
}

// NewFlightWorker creates a new FlightWorker.
func NewFlightWorker(pool *pgxpool.Pool, rdb *redis.Client, username, password string) *FlightWorker {
	return &FlightWorker{
		pool:     pool,
		rdb:      rdb,
		username: username,
		password: password,
		client:   NewHTTPClient(30 * time.Second),
		prev:     make(map[string]models.FlightEntity),
	}
}

func (w *FlightWorker) Name() string { return "flights" }

func (w *FlightWorker) Start(ctx context.Context) error {
	ticker := time.NewTicker(flightPollInterval)
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

func (w *FlightWorker) tick(ctx context.Context) {
	entities, err := w.fetch(ctx)
	if err != nil {
		w.failures++
		backoff := Backoff(w.failures, time.Second, maxBackoffDuration)
		slog.Error("flight fetch failed", "error", err, "failures", w.failures, "backoff", backoff)
		select {
		case <-ctx.Done():
		case <-time.After(backoff):
		}
		return
	}

	w.failures = 0
	slog.Info("fetched flights", "count", len(entities))

	// Build current state map.
	current := make(map[string]models.FlightEntity, len(entities))
	for _, e := range entities {
		current[e.ID] = e
	}

	// Compute upserts: new or changed entities.
	var upserts []models.FlightEntity
	for id, e := range current {
		old, existed := w.prev[id]
		if !existed || e.Lat != old.Lat || e.Lng != old.Lng || e.Altitude != old.Altitude || e.Heading != old.Heading {
			upserts = append(upserts, e)
		}
	}

	// Compute removals: entities in prev but not in current.
	var removeIDs []string
	for id := range w.prev {
		if _, ok := current[id]; !ok {
			removeIDs = append(removeIDs, id)
		}
	}

	w.prev = current

	// Publish upserts.
	if len(upserts) > 0 {
		w.publish(ctx, "upsert", upserts)
	}

	// Publish removals.
	if len(removeIDs) > 0 {
		var removes []models.FlightEntity
		for _, id := range removeIDs {
			removes = append(removes, models.FlightEntity{ID: id})
		}
		w.publish(ctx, "remove", removes)
	}

	// Persist to database.
	w.persist(ctx, entities)
}

// openSkyResponse is the JSON structure returned by the OpenSky states/all endpoint.
type openSkyResponse struct {
	Time   int64           `json:"time"`
	States [][]interface{} `json:"states"`
}

func (w *FlightWorker) fetch(ctx context.Context) ([]models.FlightEntity, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openSkyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if w.username != "" && w.password != "" {
		req.SetBasicAuth(w.username, w.password)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited (429)")
	}
	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("server error: %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var data openSkyResponse
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	entities := make([]models.FlightEntity, 0, len(data.States))
	for _, s := range data.States {
		e, ok := parseOpenSkyState(s)
		if ok {
			entities = append(entities, e)
		}
	}

	return entities, nil
}

// parseOpenSkyState converts an OpenSky state vector array into a FlightEntity.
// OpenSky array indices:
//
//	0: icao24, 1: callsign, 2: origin_country, 3: time_position,
//	4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude,
//	8: on_ground, 9: velocity, 10: true_track (heading),
//	11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk,
//	15: spi, 16: position_source
func parseOpenSkyState(s []interface{}) (models.FlightEntity, bool) {
	if len(s) < 17 {
		return models.FlightEntity{}, false
	}

	icao24, _ := s[0].(string)
	if icao24 == "" {
		return models.FlightEntity{}, false
	}

	// Longitude and latitude can be null if position is unknown.
	lng, lngOk := toFloat64(s[5])
	lat, latOk := toFloat64(s[6])
	if !lngOk || !latOk {
		return models.FlightEntity{}, false
	}

	callsign, _ := s[1].(string)
	originCountry, _ := s[2].(string)
	altitude, _ := toFloat64(s[7])
	onGround, _ := s[8].(bool)
	velocity, _ := toFloat64(s[9])
	heading, _ := toFloat64(s[10])

	source := "opensky"
	if src, _ := toFloat64(s[16]); src == 1 {
		source = "adsb"
	}

	return models.FlightEntity{
		ID:            icao24,
		Callsign:      strings.TrimSpace(callsign),
		OriginCountry: originCountry,
		Lat:           lat,
		Lng:           lng,
		Altitude:      altitude,
		Velocity:      velocity,
		Heading:       heading,
		OnGround:      onGround,
		Source:        source,
	}, true
}

func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case nil:
		return 0, false
	default:
		return 0, false
	}
}

func (w *FlightWorker) publish(ctx context.Context, action string, entities []models.FlightEntity) {
	anyEntities := make([]any, len(entities))
	for i, e := range entities {
		anyEntities[i] = e
	}

	if err := PublishDelta(ctx, w.rdb, flightRedisChannel, "flights", action, anyEntities); err != nil {
		LogPublishError("flights", err)
	}
}

func (w *FlightWorker) persist(ctx context.Context, entities []models.FlightEntity) {
	if len(entities) == 0 {
		return
	}

	rows := make([][]interface{}, len(entities))
	for i, e := range entities {
		rows[i] = []interface{}{
			e.ID,
			e.Callsign,
			e.OriginCountry,
			fmt.Sprintf("SRID=4326;POINT(%f %f)", e.Lng, e.Lat),
			e.Altitude,
			e.Velocity,
			e.Heading,
			e.OnGround,
			e.Source,
			time.Now(),
		}
	}

	_, err := w.pool.CopyFrom(ctx,
		pgx.Identifier{"flights"},
		[]string{"icao24", "callsign", "origin_country", "position", "altitude", "velocity", "heading", "on_ground", "source", "recorded_at"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		slog.Error("flight persist error", "error", err)
	}
}
