package broadcast

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/redis/go-redis/v9"
)

// DefaultChannels are the Redis pub/sub channels the broadcaster subscribes to.
var DefaultChannels = []string{
	"channel:flights",
	"channel:vessels",
	"channel:trains",
	"channel:satellites",
	"channel:events",
	"channel:conflicts",
}

// spatialLayers are layers whose entities contain lat/lng and should be filtered.
var spatialLayers = map[string]bool{
	"flights":    true,
	"vessels":    true,
	"trains":     true,
	"satellites": true,
}

// Broadcaster subscribes to Redis pub/sub channels and fans out messages
// to all connected WebSocket clients.
type Broadcaster struct {
	rdb      *redis.Client
	channels []string
	mu       sync.RWMutex
	clients  map[*Client]struct{}
}

// NewBroadcaster creates a new Broadcaster backed by the given Redis client.
// If no channels are provided, DefaultChannels are used.
func NewBroadcaster(rdb *redis.Client, channels ...string) *Broadcaster {
	if len(channels) == 0 {
		channels = DefaultChannels
	}
	return &Broadcaster{
		rdb:      rdb,
		channels: channels,
		clients:  make(map[*Client]struct{}),
	}
}

// Register adds a client to the broadcast registry.
func (b *Broadcaster) Register(c *Client) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.clients[c] = struct{}{}
	slog.Info("client registered", "total_clients", len(b.clients))
}

// Unregister removes a client from the broadcast registry and closes its send channel.
func (b *Broadcaster) Unregister(c *Client) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.clients[c]; ok {
		close(c.send)
		delete(b.clients, c)
		slog.Info("client unregistered", "total_clients", len(b.clients))
	}
}

// Start subscribes to Redis pub/sub channels and fans out received messages
// to all connected clients. It blocks until the context is cancelled.
func (b *Broadcaster) Start(ctx context.Context) error {
	sub := b.rdb.Subscribe(ctx, b.channels...)
	defer sub.Close()

	// Wait for confirmation that we are subscribed.
	_, err := sub.Receive(ctx)
	if err != nil {
		return err
	}

	slog.Info("broadcaster subscribed to redis channels", "channels", b.channels)

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			slog.Info("broadcaster shutting down")
			return ctx.Err()
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			b.fanOut([]byte(msg.Payload))
		}
	}
}

// positionedEntity extracts only the position fields from an entity JSON object.
type positionedEntity struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// deltaEnvelope is the outer structure of a delta message, with entities kept as raw JSON.
type deltaEnvelope struct {
	Layer    string            `json:"layer"`
	Action   string            `json:"action"`
	Entities []json.RawMessage `json:"entities"`
}

// fanOut sends a message to every connected client. For spatial layers, entities
// are filtered per-client based on their reported viewport bounds.
// Snapshots the client list under RLock, then releases it before doing any
// JSON parsing, spatial filtering, or channel sends.
func (b *Broadcaster) fanOut(data []byte) {
	// Snapshot clients under read lock.
	b.mu.RLock()
	clients := make([]*Client, 0, len(b.clients))
	for c := range b.clients {
		clients = append(clients, c)
	}
	b.mu.RUnlock()

	if len(clients) == 0 {
		return
	}

	// Parse the message once to determine if spatial filtering applies.
	var envelope deltaEnvelope
	var positions []positionedEntity
	needsFiltering := false
	parsed := false

	var slow []*Client

	for _, c := range clients {
		bounds := c.Bounds()

		// Fast path: no bounds set yet — send unfiltered raw bytes.
		if bounds == nil {
			select {
			case c.send <- data:
			default:
				slow = append(slow, c)
			}
			continue
		}

		// Lazy parse on first client that has bounds.
		if !parsed {
			parsed = true
			if err := json.Unmarshal(data, &envelope); err != nil {
				// Can't parse — send raw to all remaining clients.
				for _, rc := range clients {
					select {
					case rc.send <- data:
					default:
						slow = append(slow, rc)
					}
				}
				break
			}
			if spatialLayers[envelope.Layer] && envelope.Action == "upsert" {
				needsFiltering = true
				positions = make([]positionedEntity, len(envelope.Entities))
				for i, raw := range envelope.Entities {
					json.Unmarshal(raw, &positions[i]) //nolint:errcheck
				}
			}
		}

		if !needsFiltering {
			select {
			case c.send <- data:
			default:
				slow = append(slow, c)
			}
			continue
		}

		// Filter entities to those within this client's viewport.
		filtered := make([]json.RawMessage, 0, len(envelope.Entities))
		for i, pos := range positions {
			if bounds.Contains(pos.Lat, pos.Lng) {
				filtered = append(filtered, envelope.Entities[i])
			}
		}

		if len(filtered) == 0 {
			continue
		}

		// If all entities match, send the original bytes to avoid re-marshaling.
		var msg []byte
		if len(filtered) == len(envelope.Entities) {
			msg = data
		} else {
			out := deltaEnvelope{
				Layer:    envelope.Layer,
				Action:   envelope.Action,
				Entities: filtered,
			}
			var err error
			msg, err = json.Marshal(out)
			if err != nil {
				slog.Warn("failed to marshal filtered message", "error", err)
				continue
			}
		}

		select {
		case c.send <- msg:
		default:
			slow = append(slow, c)
		}
	}

	for _, c := range slow {
		slog.Warn("dropping slow client")
		b.Unregister(c)
	}
}
