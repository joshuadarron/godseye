package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

const (
	acledBaseURL           = "https://api.acleddata.com/acled/read"
	conflictPollInterval   = 15 * time.Minute
	conflictRedisChannel   = "channel:conflicts"
)

// acledResponse is the top-level response from the ACLED API.
type acledResponse struct {
	Status int         `json:"status"`
	Data   []acledEvent `json:"data"`
}

type acledEvent struct {
	DataID       json.Number `json:"data_id"`
	EventDate    string      `json:"event_date"`
	EventType    string      `json:"event_type"`
	SubEventType string      `json:"sub_event_type"`
	Actor1       string      `json:"actor1"`
	Actor2       string      `json:"actor2"`
	Country      string      `json:"country"`
	Admin1       string      `json:"admin1"`
	Location     string      `json:"location"`
	Latitude     string      `json:"latitude"`
	Longitude    string      `json:"longitude"`
	Fatalities   string      `json:"fatalities"`
	Notes        string      `json:"notes"`
	Source       string      `json:"source"`
	Timestamp    string      `json:"timestamp"`
}

// ConflictWorker polls the ACLED API and publishes armed conflict events.
type ConflictWorker struct {
	pool     *pgxpool.Pool
	rdb      *redis.Client
	client   *http.Client
	apiKey   string
	email    string
	prev     map[string]models.ConflictEntity
	failures int
}

// NewConflictWorker creates a new ConflictWorker.
func NewConflictWorker(pool *pgxpool.Pool, rdb *redis.Client, apiKey, email string) *ConflictWorker {
	return &ConflictWorker{
		pool:   pool,
		rdb:    rdb,
		client: NewHTTPClient(30 * time.Second),
		apiKey: apiKey,
		email:  email,
		prev:   make(map[string]models.ConflictEntity),
	}
}

func (w *ConflictWorker) Name() string { return "conflicts" }

func (w *ConflictWorker) Start(ctx context.Context) error {
	if w.apiKey == "" || w.email == "" {
		slog.Warn("ACLED API key or email not set — conflicts worker disabled")
		<-ctx.Done()
		return nil
	}

	ticker := time.NewTicker(conflictPollInterval)
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

func (w *ConflictWorker) tick(ctx context.Context) {
	var entities []models.ConflictEntity
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		entities, err = w.fetch(ctx)
		if err == nil {
			break
		}
		w.failures++
		backoff := Backoff(w.failures, time.Second, 30*time.Second)
		slog.Error("conflict fetch failed", "error", err, "failures", w.failures, "attempt", attempt+1, "backoff", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
	}
	if err != nil {
		return
	}

	w.failures = 0
	slog.Info("fetched conflicts", "count", len(entities))

	// Build current state map.
	current := make(map[string]models.ConflictEntity, len(entities))
	for _, e := range entities {
		current[e.ID] = e
	}

	// Compute removals.
	var removes []models.ConflictEntity
	for id := range w.prev {
		if _, ok := current[id]; !ok {
			removes = append(removes, models.ConflictEntity{ID: id})
		}
	}

	w.prev = current

	// Publish ALL entities on every tick (static events, same as earthquakes).
	if len(entities) > 0 {
		anyEntities := make([]any, len(entities))
		for i, e := range entities {
			anyEntities[i] = e
		}
		if err := PublishDelta(ctx, w.rdb, conflictRedisChannel, "conflicts", "upsert", anyEntities); err != nil {
			LogPublishError("conflicts", err)
		}
	}

	if len(removes) > 0 {
		anyEntities := make([]any, len(removes))
		for i, e := range removes {
			anyEntities[i] = e
		}
		if err := PublishDelta(ctx, w.rdb, conflictRedisChannel, "conflicts", "remove", anyEntities); err != nil {
			LogPublishError("conflicts", err)
		}
	}

	w.persist(ctx, entities)
}

func (w *ConflictWorker) fetch(ctx context.Context) ([]models.ConflictEntity, error) {
	// Query last 7 days of events.
	now := time.Now().UTC()
	startDate := now.AddDate(0, 0, -7).Format("2006-01-02")
	endDate := now.Format("2006-01-02")

	url := fmt.Sprintf("%s?key=%s&email=%s&event_date=%s|%s&event_date_where=BETWEEN&limit=5000",
		acledBaseURL, w.apiKey, w.email, startDate, endDate)

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

	var acledResp acledResponse
	if err := json.Unmarshal(body, &acledResp); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	entities := make([]models.ConflictEntity, 0, len(acledResp.Data))
	for _, ev := range acledResp.Data {
		lat, err := strconv.ParseFloat(ev.Latitude, 64)
		if err != nil || lat < -90 || lat > 90 {
			continue
		}
		lng, err := strconv.ParseFloat(ev.Longitude, 64)
		if err != nil || lng < -180 || lng > 180 {
			continue
		}

		fatalities, _ := strconv.Atoi(ev.Fatalities)

		entities = append(entities, models.ConflictEntity{
			ID:           ev.DataID.String(),
			Lat:          lat,
			Lng:          lng,
			EventDate:    ev.EventDate,
			EventType:    ev.EventType,
			SubEventType: ev.SubEventType,
			Actor1:       ev.Actor1,
			Actor2:       ev.Actor2,
			Country:      ev.Country,
			Admin1:       ev.Admin1,
			Location:     ev.Location,
			Fatalities:   fatalities,
			Notes:        ev.Notes,
			Source:        ev.Source,
			Timestamp:    ev.Timestamp,
		})
	}

	return entities, nil
}

func (w *ConflictWorker) persist(ctx context.Context, entities []models.ConflictEntity) {
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
		sb.WriteString("INSERT INTO conflicts (acled_id, position, event_date, event_type, sub_event_type, actor1, actor2, country, admin1, location, fatalities, notes, source, acled_timestamp, recorded_at) VALUES ")

		args := make([]interface{}, 0, len(batch)*15)
		for i, e := range batch {
			if i > 0 {
				sb.WriteString(",")
			}
			p := i * 15
			fmt.Fprintf(&sb, "($%d,ST_SetSRID(ST_MakePoint($%d,$%d),4326)::geography,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
				p+1, p+2, p+3, p+4, p+5, p+6, p+7, p+8, p+9, p+10, p+11, p+12, p+13, p+14, p+15)

			eventDate, _ := time.Parse("2006-01-02", e.EventDate)
			acledTimestamp, _ := time.Parse("2006-01-02", e.Timestamp)
			if acledTimestamp.IsZero() {
				acledTimestamp = eventDate
			}

			args = append(args, e.ID, e.Lng, e.Lat, eventDate, e.EventType, e.SubEventType, e.Actor1, e.Actor2, e.Country, e.Admin1, e.Location, e.Fatalities, e.Notes, e.Source, now)
		}

		_, err := w.pool.Exec(ctx, sb.String(), args...)
		if err != nil {
			slog.Error("conflict persist error", "error", err)
		}
	}
}
