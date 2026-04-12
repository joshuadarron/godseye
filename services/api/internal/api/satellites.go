package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type satelliteHandler struct {
	pool *pgxpool.Pool
}

type satelliteRow struct {
	NoradID  int    `json:"noradId"`
	Name     string `json:"name"`
	TLELine1 string `json:"tle1"`
	TLELine2 string `json:"tle2"`
	FetchedAt string `json:"fetchedAt"`
}

// list returns the latest TLE set for all satellites.
func (h *satelliteHandler) list(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	limit, offset := parsePagination(r, 1000, 10000)

	query := `
		SELECT DISTINCT ON (norad_id)
			norad_id, name, tle_line1, tle_line2, fetched_at
		FROM satellite_tles
		ORDER BY norad_id, fetched_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := h.pool.Query(ctx, query, limit, offset)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := make([]satelliteRow, 0, limit)
	for rows.Next() {
		var s satelliteRow
		var fetchedAt time.Time
		if err := rows.Scan(&s.NoradID, &s.Name, &s.TLELine1, &s.TLELine2, &fetchedAt); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		s.FetchedAt = fetchedAt.Format(time.RFC3339)
		results = append(results, s)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=60")
	json.NewEncoder(w).Encode(results)
}

// history returns the TLE history for a given satellite (norad_id) within a time range.
func (h *satelliteHandler) history(w http.ResponseWriter, r *http.Request) {
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
		SELECT norad_id, name, tle_line1, tle_line2, fetched_at
		FROM satellite_tles
		WHERE norad_id = $1 AND fetched_at BETWEEN $2 AND $3
		ORDER BY fetched_at ASC
	`

	rows, err := h.pool.Query(ctx, query, id, fromTime, toTime)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []satelliteRow
	for rows.Next() {
		var s satelliteRow
		var fetchedAt time.Time
		if err := rows.Scan(&s.NoradID, &s.Name, &s.TLELine1, &s.TLELine2, &fetchedAt); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		s.FetchedAt = fetchedAt.Format(time.RFC3339)
		results = append(results, s)
	}

	if results == nil {
		results = []satelliteRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=60")
	json.NewEncoder(w).Encode(results)
}
