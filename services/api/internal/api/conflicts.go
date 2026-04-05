package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type conflictHandler struct {
	pool *pgxpool.Pool
}

type conflictRow struct {
	ACLEDID      string `json:"id"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	EventDate    string `json:"eventDate"`
	EventType    string `json:"eventType"`
	SubEventType string `json:"subEventType"`
	Actor1       string `json:"actor1"`
	Actor2       string `json:"actor2"`
	Country      string `json:"country"`
	Admin1       string `json:"admin1"`
	Location     string `json:"location"`
	Fatalities   int    `json:"fatalities"`
	Notes        string `json:"notes"`
	Source       string `json:"source"`
	Timestamp    string `json:"timestamp"`
	RecordedAt   string `json:"recordedAt"`
}

// list returns the latest conflict events.
func (h *conflictHandler) list(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT DISTINCT ON (acled_id)
			acled_id,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			event_date, event_type, sub_event_type,
			actor1, actor2, country, admin1, location,
			fatalities, notes, source, acled_timestamp, recorded_at
		FROM conflicts
		WHERE recorded_at > NOW() - INTERVAL '7 days'
		ORDER BY acled_id, recorded_at DESC
	`

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []conflictRow
	for rows.Next() {
		var c conflictRow
		var eventDate, acledTimestamp, recordedAt time.Time
		if err := rows.Scan(
			&c.ACLEDID, &c.Lat, &c.Lng,
			&eventDate, &c.EventType, &c.SubEventType,
			&c.Actor1, &c.Actor2, &c.Country, &c.Admin1, &c.Location,
			&c.Fatalities, &c.Notes, &c.Source, &acledTimestamp, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		c.EventDate = eventDate.Format("2006-01-02")
		c.Timestamp = acledTimestamp.Format(time.RFC3339)
		c.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, c)
	}

	if results == nil {
		results = []conflictRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// history returns the history for a given conflict by ACLED ID.
func (h *conflictHandler) history(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	var fromTime, toTime time.Time
	var err error

	if from != "" {
		fromTime, err = time.Parse(time.RFC3339, from)
		if err != nil {
			http.Error(w, "invalid 'from' parameter", http.StatusBadRequest)
			return
		}
	} else {
		fromTime = time.Now().Add(-7 * 24 * time.Hour)
	}

	if to != "" {
		toTime, err = time.Parse(time.RFC3339, to)
		if err != nil {
			http.Error(w, "invalid 'to' parameter", http.StatusBadRequest)
			return
		}
	} else {
		toTime = time.Now()
	}

	query := `
		SELECT acled_id,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			event_date, event_type, sub_event_type,
			actor1, actor2, country, admin1, location,
			fatalities, notes, source, acled_timestamp, recorded_at
		FROM conflicts
		WHERE acled_id = $1 AND recorded_at BETWEEN $2 AND $3
		ORDER BY recorded_at ASC
	`

	rows, err := h.pool.Query(ctx, query, id, fromTime, toTime)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []conflictRow
	for rows.Next() {
		var c conflictRow
		var eventDate, acledTimestamp, recordedAt time.Time
		if err := rows.Scan(
			&c.ACLEDID, &c.Lat, &c.Lng,
			&eventDate, &c.EventType, &c.SubEventType,
			&c.Actor1, &c.Actor2, &c.Country, &c.Admin1, &c.Location,
			&c.Fatalities, &c.Notes, &c.Source, &acledTimestamp, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		c.EventDate = eventDate.Format("2006-01-02")
		c.Timestamp = acledTimestamp.Format(time.RFC3339)
		c.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, c)
	}

	if results == nil {
		results = []conflictRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
