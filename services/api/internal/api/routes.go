package api

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RegisterRoutes adds REST API endpoints to the given mux.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool) {
	fh := &flightHandler{pool: pool}
	mux.HandleFunc("GET /api/flights", fh.list)
	mux.HandleFunc("GET /api/flights/{id}", fh.history)

	sh := &satelliteHandler{pool: pool}
	mux.HandleFunc("GET /api/satellites", sh.list)
	mux.HandleFunc("GET /api/satellites/{id}", sh.history)

	vh := &vesselHandler{pool: pool}
	mux.HandleFunc("GET /api/vessels", vh.list)
	mux.HandleFunc("GET /api/vessels/{id}", vh.history)

	eh := &earthquakeHandler{pool: pool}
	mux.HandleFunc("GET /api/earthquakes", eh.list)
	mux.HandleFunc("GET /api/earthquakes/{id}", eh.history)

	ch := &conflictHandler{pool: pool}
	mux.HandleFunc("GET /api/conflicts", ch.list)
	mux.HandleFunc("GET /api/conflicts/{id}", ch.history)
}
