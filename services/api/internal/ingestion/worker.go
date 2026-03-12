package ingestion

import "context"

// Worker is the interface that all data source ingestion workers must implement.
type Worker interface {
	// Name returns a human-readable name for the worker (e.g., "flights", "vessels").
	Name() string

	// Start begins the ingestion loop. It should block until the context is
	// cancelled or a fatal error occurs.
	Start(ctx context.Context) error
}
