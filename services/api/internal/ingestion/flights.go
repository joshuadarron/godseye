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
	openSkyURL         = "https://opensky-network.org/api/states/all"
	openSkyTokenURL    = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
	flightPollInterval = 10 * time.Second
	flightRedisChannel = "channel:flights"
	maxBackoffDuration = 5 * time.Minute
	// Refresh the OAuth token 60 seconds before it expires to avoid mid-request expiry.
	tokenRefreshBuffer = 60 * time.Second
)

// FlightWorker polls the OpenSky Network API and publishes flight deltas.
type FlightWorker struct {
	pool         *pgxpool.Pool
	rdb          *redis.Client
	clientID     string
	clientSecret string
	client       *http.Client

	prev     map[string]models.FlightEntity
	failures int

	// OAuth2 token state.
	accessToken string
	tokenExpiry time.Time
}

// NewFlightWorker creates a new FlightWorker.
func NewFlightWorker(pool *pgxpool.Pool, rdb *redis.Client, clientID, clientSecret string) *FlightWorker {
	return &FlightWorker{
		pool:         pool,
		rdb:          rdb,
		clientID:     clientID,
		clientSecret: clientSecret,
		client:       NewHTTPClient(30 * time.Second),
		prev:         make(map[string]models.FlightEntity),
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

// tokenResponse is the JSON returned by the OpenSky OAuth2 token endpoint.
type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

// refreshToken fetches a new OAuth2 bearer token using the client credentials flow.
func (w *FlightWorker) refreshToken(ctx context.Context) error {
	body := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", w.clientID, w.clientSecret)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openSkyTokenURL, strings.NewReader(body))
	if err != nil {
		return fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := w.client.Do(req)
	if err != nil {
		return fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("token request failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return fmt.Errorf("decode token response: %w", err)
	}

	w.accessToken = tok.AccessToken
	w.tokenExpiry = time.Now().Add(time.Duration(tok.ExpiresIn)*time.Second - tokenRefreshBuffer)
	slog.Info("opensky oauth token refreshed", "expires_in", tok.ExpiresIn)
	return nil
}

// ensureToken refreshes the OAuth2 token if it's expired or about to expire.
func (w *FlightWorker) ensureToken(ctx context.Context) error {
	if w.clientID == "" || w.clientSecret == "" {
		return nil // No credentials — use anonymous access.
	}
	if w.accessToken != "" && time.Now().Before(w.tokenExpiry) {
		return nil // Token is still valid.
	}
	return w.refreshToken(ctx)
}

func (w *FlightWorker) fetch(ctx context.Context) ([]models.FlightEntity, error) {
	// Ensure we have a valid OAuth2 token (if credentials are configured).
	if err := w.ensureToken(ctx); err != nil {
		slog.Warn("oauth token refresh failed, falling back to anonymous", "error", err)
		w.accessToken = ""
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openSkyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if w.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+w.accessToken)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	// If we get a 401 with a token, invalidate it and retry anonymously.
	if resp.StatusCode == http.StatusUnauthorized && w.accessToken != "" {
		resp.Body.Close()
		slog.Warn("opensky bearer token rejected (401), retrying anonymously")
		w.accessToken = ""
		w.tokenExpiry = time.Time{}
		return w.fetch(ctx)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited (429)")
	}
	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("server error: %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var data openSkyResponse
	if err := json.Unmarshal(respBody, &data); err != nil {
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

	// Build a batch INSERT with ST_SetSRID(ST_MakePoint(...)) so PostGIS
	// converts text coordinates to geography on the server side.
	// CopyFrom uses binary protocol which can't handle EWKT text strings.
	const batchSize = 1000
	now := time.Now()

	for start := 0; start < len(entities); start += batchSize {
		end := start + batchSize
		if end > len(entities) {
			end = len(entities)
		}
		batch := entities[start:end]

		var sb strings.Builder
		sb.WriteString("INSERT INTO flights (icao24, callsign, origin_country, position, altitude, velocity, heading, on_ground, source, recorded_at) VALUES ")

		args := make([]interface{}, 0, len(batch)*11)
		for i, e := range batch {
			if i > 0 {
				sb.WriteString(",")
			}
			p := i * 11
			fmt.Fprintf(&sb, "($%d,$%d,$%d,ST_SetSRID(ST_MakePoint($%d,$%d),4326)::geography,$%d,$%d,$%d,$%d,$%d,$%d)",
				p+1, p+2, p+3, p+4, p+5, p+6, p+7, p+8, p+9, p+10, p+11)
			args = append(args, e.ID, e.Callsign, e.OriginCountry, e.Lng, e.Lat, e.Altitude, e.Velocity, e.Heading, e.OnGround, e.Source, now)
		}

		_, err := w.pool.Exec(ctx, sb.String(), args...)
		if err != nil {
			slog.Error("flight persist error", "error", err)
		}
	}
}
