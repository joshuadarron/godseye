package ingestion

import (
	"context"
	"encoding/json"
	"log/slog"
	"math/rand"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

// PublishDelta marshals and publishes a DeltaMessage to the given Redis channel.
func PublishDelta(ctx context.Context, rdb *redis.Client, channel, layer, action string, entities []any) error {
	msg := models.DeltaMessage{
		Layer:    layer,
		Action:   action,
		Entities: entities,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return rdb.Publish(ctx, channel, data).Err()
}

// NewHTTPClient creates an HTTP client with the given timeout.
func NewHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout}
}

// Backoff computes exponential backoff with jitter.
func Backoff(failures int, base, max time.Duration) time.Duration {
	exp := base << failures
	if exp > max || exp <= 0 {
		exp = max
	}
	jitter := time.Duration(rand.Int63n(int64(exp) / 2))
	d := exp/2 + jitter
	if d > max {
		d = max
	}
	return d
}

// LogPublishError is a convenience for logging publish failures.
func LogPublishError(layer string, err error) {
	slog.Error("publish error", "layer", layer, "error", err)
}
