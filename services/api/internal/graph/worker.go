package graph

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// DeltaMessage mirrors the WebSocket message format from the existing broadcaster.
type DeltaMessage struct {
	Layer    string   `json:"layer"`
	Action   string   `json:"action"` // "upsert" | "remove"
	Entities []Entity `json:"entities"`
}

// Entity is a single entity from a delta message.
type Entity struct {
	ID       string  `json:"id"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Heading  float64 `json:"heading"`
	Altitude float64 `json:"altitude"`
}

// Worker subscribes to Redis channels and writes entity data into the graph.
type Worker struct {
	client *Client
	redis  *redis.Client
	cfg    ProximityConfig
	logger *slog.Logger
}

func NewWorker(client *Client, rdb *redis.Client, cfg ProximityConfig, logger *slog.Logger) *Worker {
	return &Worker{client: client, redis: rdb, cfg: cfg, logger: logger}
}

// Run blocks until ctx is cancelled. Subscribe to Redis and drive graph writes.
func (w *Worker) Run(ctx context.Context) {
	channels := []string{"channel:flights", "channel:satellites", "channel:vessels"}
	sub := w.redis.Subscribe(ctx, channels...)
	defer sub.Close()

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			if err := w.handleMessage(ctx, msg); err != nil {
				w.logger.Error("graph worker: handle message failed", "err", err)
			}
		}
	}
}

func (w *Worker) handleMessage(ctx context.Context, msg *redis.Message) error {
	var delta DeltaMessage
	if err := json.Unmarshal([]byte(msg.Payload), &delta); err != nil {
		return err
	}

	entityType := layerToEntityType(delta.Layer)
	if entityType == "" {
		return nil
	}

	for _, e := range delta.Entities {
		if delta.Action == "remove" {
			if err := w.client.RemoveEntity(ctx, entityType, e.ID); err != nil {
				w.logger.Warn("graph: remove entity failed", "id", e.ID, "err", err)
			}
			continue
		}

		node := EntityNode{
			ID:        e.ID,
			Type:      entityType,
			Lat:       e.Lat,
			Lng:       e.Lng,
			Heading:   e.Heading,
			Altitude:  e.Altitude,
			UpdatedAt: time.Now(),
		}
		if err := w.client.UpsertEntity(ctx, node); err != nil {
			w.logger.Warn("graph: upsert entity failed", "id", e.ID, "err", err)
			continue
		}

		// Recompute proximity edges asynchronously to avoid blocking ingest loop.
		go func(id string, et EntityType) {
			if err := w.client.RecomputeProximityEdges(ctx, et, id, w.cfg); err != nil {
				w.logger.Warn("graph: proximity recompute failed", "id", id, "err", err)
			}
		}(e.ID, entityType)
	}
	return nil
}

func layerToEntityType(layer string) EntityType {
	switch layer {
	case "flights":
		return EntityFlight
	case "satellites":
		return EntitySatellite
	case "vessels":
		return EntityVessel
	}
	return ""
}
