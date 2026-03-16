package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type vesselHandler struct {
	pool *pgxpool.Pool
}

type vesselRow struct {
	MMSI        string  `json:"id"`
	Name        string  `json:"name"`
	Callsign    string  `json:"callsign"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Speed       float64 `json:"speed"`
	Course      float64 `json:"course"`
	Heading     float64 `json:"heading"`
	ShipType    int     `json:"shipType"`
	IMO         int     `json:"imo"`
	Destination string  `json:"destination"`
	Length      float64 `json:"length"`
	Width       float64 `json:"width"`
	Draught     float64 `json:"draught"`
	NavStatus   int     `json:"navStatus"`
	RecordedAt  string  `json:"recordedAt"`
}

// list returns the latest position for each vessel.
func (h *vesselHandler) list(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT DISTINCT ON (mmsi)
			mmsi, name, callsign,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			speed, course, heading, ship_type, imo, destination,
			length, width, draught, nav_status, recorded_at
		FROM vessels
		WHERE recorded_at > NOW() - INTERVAL '10 minutes'
		ORDER BY mmsi, recorded_at DESC
	`

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []vesselRow
	for rows.Next() {
		var v vesselRow
		var recordedAt time.Time
		if err := rows.Scan(
			&v.MMSI, &v.Name, &v.Callsign,
			&v.Lat, &v.Lng,
			&v.Speed, &v.Course, &v.Heading, &v.ShipType, &v.IMO, &v.Destination,
			&v.Length, &v.Width, &v.Draught, &v.NavStatus, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		v.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, v)
	}

	if results == nil {
		results = []vesselRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// history returns the position history for a given vessel (MMSI) within a time range.
func (h *vesselHandler) history(w http.ResponseWriter, r *http.Request) {
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
		fromTime = time.Now().Add(-1 * time.Hour)
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
		SELECT mmsi, name, callsign,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			speed, course, heading, ship_type, imo, destination,
			length, width, draught, nav_status, recorded_at
		FROM vessels
		WHERE mmsi = $1 AND recorded_at BETWEEN $2 AND $3
		ORDER BY recorded_at ASC
	`

	rows, err := h.pool.Query(ctx, query, id, fromTime, toTime)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []vesselRow
	for rows.Next() {
		var v vesselRow
		var recordedAt time.Time
		if err := rows.Scan(
			&v.MMSI, &v.Name, &v.Callsign,
			&v.Lat, &v.Lng,
			&v.Speed, &v.Course, &v.Heading, &v.ShipType, &v.IMO, &v.Destination,
			&v.Length, &v.Width, &v.Draught, &v.NavStatus, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		v.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, v)
	}

	if results == nil {
		results = []vesselRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
