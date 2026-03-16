package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type earthquakeHandler struct {
	pool *pgxpool.Pool
}

type earthquakeRow struct {
	USGSID       string  `json:"id"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	Magnitude    float64 `json:"magnitude"`
	Place        string  `json:"place"`
	Depth        float64 `json:"depth"`
	EventTime    string  `json:"time"`
	URL          string  `json:"url"`
	Alert        string  `json:"alert"`
	Tsunami      int     `json:"tsunami"`
	Significance int     `json:"significance"`
	MagType      string  `json:"magType"`
	Status       string  `json:"status"`
	RecordedAt   string  `json:"recordedAt"`
}

// list returns the latest earthquake events.
func (h *earthquakeHandler) list(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT DISTINCT ON (usgs_id)
			usgs_id,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			magnitude, place, depth, event_time, url, alert,
			tsunami, significance, mag_type, status, recorded_at
		FROM earthquakes
		WHERE recorded_at > NOW() - INTERVAL '24 hours'
		ORDER BY usgs_id, recorded_at DESC
	`

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []earthquakeRow
	for rows.Next() {
		var e earthquakeRow
		var eventTime, recordedAt time.Time
		if err := rows.Scan(
			&e.USGSID, &e.Lat, &e.Lng,
			&e.Magnitude, &e.Place, &e.Depth, &eventTime, &e.URL, &e.Alert,
			&e.Tsunami, &e.Significance, &e.MagType, &e.Status, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		e.EventTime = eventTime.Format(time.RFC3339)
		e.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, e)
	}

	if results == nil {
		results = []earthquakeRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// history returns the history for a given earthquake by USGS ID.
func (h *earthquakeHandler) history(w http.ResponseWriter, r *http.Request) {
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
		fromTime = time.Now().Add(-24 * time.Hour)
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
		SELECT usgs_id,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			magnitude, place, depth, event_time, url, alert,
			tsunami, significance, mag_type, status, recorded_at
		FROM earthquakes
		WHERE usgs_id = $1 AND recorded_at BETWEEN $2 AND $3
		ORDER BY recorded_at ASC
	`

	rows, err := h.pool.Query(ctx, query, id, fromTime, toTime)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []earthquakeRow
	for rows.Next() {
		var e earthquakeRow
		var eventTime, recordedAt time.Time
		if err := rows.Scan(
			&e.USGSID, &e.Lat, &e.Lng,
			&e.Magnitude, &e.Place, &e.Depth, &eventTime, &e.URL, &e.Alert,
			&e.Tsunami, &e.Significance, &e.MagType, &e.Status, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		e.EventTime = eventTime.Format(time.RFC3339)
		e.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, e)
	}

	if results == nil {
		results = []earthquakeRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
