package db

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.up.sql
var migrationsFS embed.FS

// Migrate runs all pending SQL migrations in order. It uses a simple
// schema_migrations table to track which migrations have already been applied.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	// Ensure the tracking table exists.
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Read all .up.sql files from the embedded filesystem.
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")

		// Check if already applied.
		var exists bool
		err := pool.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)",
			version,
		).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if exists {
			continue
		}

		// Read and execute the migration.
		sql, err := migrationsFS.ReadFile("migrations/" + file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", file, err)
		}

		slog.Info("applying migration", "version", version)
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply migration %s: %w", version, err)
		}

		// Record the migration.
		if _, err := pool.Exec(ctx,
			"INSERT INTO schema_migrations (version) VALUES ($1)", version,
		); err != nil {
			return fmt.Errorf("record migration %s: %w", version, err)
		}
	}

	return nil
}
