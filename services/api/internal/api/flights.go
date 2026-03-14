package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type flightHandler struct {
	pool *pgxpool.Pool
}

type flightRow struct {
	ICAO24        string  `json:"id"`
	Callsign      string  `json:"callsign"`
	OriginCountry string  `json:"originCountry"`
	Lat           float64 `json:"lat"`
	Lng           float64 `json:"lng"`
	Altitude      float64 `json:"altitude"`
	Velocity      float64 `json:"velocity"`
	Heading       float64 `json:"heading"`
	OnGround      bool    `json:"onGround"`
	Source        string  `json:"source"`
	RecordedAt    string  `json:"recordedAt"`
}

// list returns the latest position for each flight.
func (h *flightHandler) list(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT DISTINCT ON (icao24)
			icao24, callsign, origin_country,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			altitude, velocity, heading, on_ground, source, recorded_at
		FROM flights
		WHERE recorded_at > NOW() - INTERVAL '5 minutes'
		ORDER BY icao24, recorded_at DESC
	`

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []flightRow
	for rows.Next() {
		var f flightRow
		var recordedAt time.Time
		if err := rows.Scan(
			&f.ICAO24, &f.Callsign, &f.OriginCountry,
			&f.Lat, &f.Lng,
			&f.Altitude, &f.Velocity, &f.Heading, &f.OnGround, &f.Source, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		f.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, f)
	}

	if results == nil {
		results = []flightRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// history returns the position history for a given flight (icao24) within a time range.
func (h *flightHandler) history(w http.ResponseWriter, r *http.Request) {
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
		SELECT icao24, callsign, origin_country,
			ST_Y(position::geometry) AS lat,
			ST_X(position::geometry) AS lng,
			altitude, velocity, heading, on_ground, source, recorded_at
		FROM flights
		WHERE icao24 = $1 AND recorded_at BETWEEN $2 AND $3
		ORDER BY recorded_at ASC
	`

	rows, err := h.pool.Query(ctx, query, id, fromTime, toTime)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []flightRow
	for rows.Next() {
		var f flightRow
		var recordedAt time.Time
		if err := rows.Scan(
			&f.ICAO24, &f.Callsign, &f.OriginCountry,
			&f.Lat, &f.Lng,
			&f.Altitude, &f.Velocity, &f.Heading, &f.OnGround, &f.Source, &recordedAt,
		); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		f.RecordedAt = recordedAt.Format(time.RFC3339)
		results = append(results, f)
	}

	if results == nil {
		results = []flightRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
