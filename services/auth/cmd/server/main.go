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

	"github.com/joshuaferrara/godseye/services/auth/internal/api"
	"github.com/joshuaferrara/godseye/services/auth/internal/config"
	"github.com/joshuaferrara/godseye/services/auth/internal/db"
	"github.com/joshuaferrara/godseye/services/auth/internal/handlers"
	"github.com/joshuaferrara/godseye/services/auth/internal/middleware"
	"github.com/joshuaferrara/godseye/services/auth/internal/repository"
)

func main() {
	// Load .env file if present; ignore errors (production uses real env vars).
	_ = godotenv.Load()

	cfg := config.Load()

	if cfg.JWTSecret == "" {
		slog.Error("JWT_SECRET is required")
		os.Exit(1)
	}

	slog.Info("starting godseye auth service", "addr", cfg.ServerAddr)

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

	// Set up repositories.
	userRepo := repository.NewUserRepo(pool)
	tokenRepo := repository.NewTokenRepo(pool)

	// Set up handlers.
	authHandler := handlers.NewAuthHandler(cfg, userRepo, tokenRepo)
	oauthHandler := handlers.NewOAuthHandler(cfg, userRepo, tokenRepo)

	// Set up HTTP routes.
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	api.RegisterRoutes(mux, authHandler, oauthHandler)

	handler := middleware.Chain(
		middleware.RequestID,
		middleware.Logging,
		middleware.SecurityHeaders,
		middleware.CORSWithOrigins(cfg.AllowedOrigins),
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

	slog.Info("server stopped")
}
