package ingestion

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Manager holds a collection of ingestion Workers and manages their lifecycles.
type Manager struct {
	workers []Worker
	done    chan struct{}
}

// NewManager creates a Manager with the given workers.
func NewManager(workers ...Worker) *Manager {
	return &Manager{
		workers: workers,
		done:    make(chan struct{}),
	}
}

// Done returns a channel that is closed when all workers have stopped.
func (m *Manager) Done() <-chan struct{} {
	return m.done
}

// StartAll launches each worker in its own goroutine and blocks until the
// context is cancelled and all workers have stopped, or until a 30-second
// shutdown timeout is reached.
func (m *Manager) StartAll(ctx context.Context) {
	var wg sync.WaitGroup

	for _, w := range m.workers {
		wg.Add(1)
		go func(w Worker) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					slog.Error("ingestion worker panicked",
						"worker", w.Name(),
						"panic", fmt.Sprintf("%v", r),
					)
				}
			}()
			slog.Info("starting ingestion worker", "worker", w.Name())
			if err := w.Start(ctx); err != nil && ctx.Err() == nil {
				slog.Error("ingestion worker failed", "worker", w.Name(), "error", err)
			}
			slog.Info("ingestion worker stopped", "worker", w.Name())
		}(w)
	}

	// Wait with a timeout to avoid blocking forever.
	waitDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(waitDone)
	}()

	select {
	case <-waitDone:
		slog.Info("all ingestion workers stopped gracefully")
	case <-time.After(30 * time.Second):
		slog.Warn("timed out waiting for ingestion workers to stop")
	}

	close(m.done)
}
