package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/api"
	"github.com/joshuaferrara/godseye/services/api/internal/broadcast"
	"github.com/joshuaferrara/godseye/services/api/internal/config"
	"github.com/joshuaferrara/godseye/services/api/internal/db"
	"github.com/joshuaferrara/godseye/services/api/internal/ingestion"
	"github.com/joshuaferrara/godseye/services/api/internal/middleware"
	"github.com/joshuaferrara/godseye/services/api/internal/ws"
)

func main() {
	// Load .env file if present; ignore errors (production uses real env vars).
	_ = godotenv.Load()

	cfg := config.Load()

	slog.Info("starting godseye server", "addr", cfg.ServerAddr)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Connect to PostgreSQL.
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to database")

	// Run database migrations.
	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")

	// Connect to Redis.
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to parse redis url", "error", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(opts)
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to redis")

	// Set up broadcaster.
	broadcaster := broadcast.NewBroadcaster(rdb)
	go func() {
		if err := broadcaster.Start(ctx); err != nil && ctx.Err() == nil {
			slog.Error("broadcaster error", "error", err)
		}
	}()

	// Set up ingestion workers.
	flightWorker := ingestion.NewFlightWorker(pool, rdb, cfg.OpenSkyClientID, cfg.OpenSkyClientSecret)
	satelliteWorker := ingestion.NewSatelliteWorker(pool, rdb)
	vesselWorker := ingestion.NewVesselWorker(pool, rdb, cfg.AISStreamAPIKey)
	earthquakeWorker := ingestion.NewEarthquakeWorker(pool, rdb)
	mgr := ingestion.NewManager(flightWorker, satelliteWorker, vesselWorker, earthquakeWorker)
	go mgr.StartAll(ctx)

	// Set up HTTP routes.
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", ws.Handler(broadcaster))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	api.RegisterRoutes(mux, pool)

	handler := middleware.Chain(
		middleware.RequestID,
		middleware.Logging,
		middleware.CORS,
	)(mux)

	srv := &http.Server{
		Addr:    cfg.ServerAddr,
		Handler: handler,
	}

	// Start HTTP server in a goroutine.
	go func() {
		slog.Info("http server listening", "addr", cfg.ServerAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http server error", "error", err)
			os.Exit(1)
		}
	}()

	// Block until shutdown signal.
	<-ctx.Done()
	slog.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	// Wait for ingestion workers to finish before closing DB/Redis connections.
	select {
	case <-mgr.Done():
		slog.Info("ingestion workers stopped")
	case <-shutdownCtx.Done():
		slog.Warn("timed out waiting for ingestion workers")
	}

	slog.Info("server stopped")
}
