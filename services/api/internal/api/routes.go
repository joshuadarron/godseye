package api

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joshuaferrara/godseye/services/api/internal/graph"
	"github.com/joshuaferrara/godseye/services/api/internal/middleware"
)

// RegisterRoutes adds REST API endpoints to the given mux.
//
// Access model: the tracking layers are public reads — an anonymous visitor gets
// the full live globe with no sign-in. Authentication gates only per-user state,
// which lives under /api/me/*. Add new user-scoped routes to that group so they
// inherit the token check.
//
// graphClient may be nil if Memgraph is not configured.
// jwtSecret may be empty, in which case the authenticated routes are not
// registered — an empty HMAC secret would accept forged tokens.
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, graphClient *graph.Client, jwtSecret string) {
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

	if graphClient != nil {
		gh := &graphHandler{client: graphClient}
		mux.HandleFunc("GET /api/graph/nearby", gh.nearby)
		mux.HandleFunc("GET /api/graph/encounters", gh.encounters)
	}

	// Authenticated routes — per-user state only.
	if jwtSecret == "" {
		slog.Warn("JWT_SECRET not set, authenticated routes disabled")
		return
	}

	requireAuth := middleware.Auth(jwtSecret)
	mux.Handle("GET /api/me", requireAuth(http.HandlerFunc(me)))
}
