package ingestion

import (
	"context"
	"log/slog"
	"sync"
)

// Manager holds a collection of ingestion Workers and manages their lifecycles.
type Manager struct {
	workers []Worker
}

// NewManager creates a Manager with the given workers.
func NewManager(workers ...Worker) *Manager {
	return &Manager{workers: workers}
}

// StartAll launches each worker in its own goroutine and blocks until the
// context is cancelled and all workers have stopped.
func (m *Manager) StartAll(ctx context.Context) {
	var wg sync.WaitGroup

	for _, w := range m.workers {
		wg.Add(1)
		go func(w Worker) {
			defer wg.Done()
			slog.Info("starting ingestion worker", "worker", w.Name())
			if err := w.Start(ctx); err != nil && ctx.Err() == nil {
				slog.Error("ingestion worker failed", "worker", w.Name(), "error", err)
			}
			slog.Info("ingestion worker stopped", "worker", w.Name())
		}(w)
	}

	wg.Wait()
}
