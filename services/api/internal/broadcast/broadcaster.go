package broadcast

import (
	"context"
	"log/slog"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Channels that the broadcaster subscribes to via Redis pub/sub.
var channels = []string{
	"channel:flights",
	"channel:vessels",
	"channel:trains",
	"channel:satellites",
	"channel:events",
}

// Broadcaster subscribes to Redis pub/sub channels and fans out messages
// to all connected WebSocket clients.
type Broadcaster struct {
	rdb     *redis.Client
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

// NewBroadcaster creates a new Broadcaster backed by the given Redis client.
func NewBroadcaster(rdb *redis.Client) *Broadcaster {
	return &Broadcaster{
		rdb:     rdb,
		clients: make(map[*Client]struct{}),
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
	sub := b.rdb.Subscribe(ctx, channels...)
	defer sub.Close()

	// Wait for confirmation that we are subscribed.
	_, err := sub.Receive(ctx)
	if err != nil {
		return err
	}

	slog.Info("broadcaster subscribed to redis channels", "channels", channels)

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

// fanOut sends a message to every connected client. Slow clients whose
// send buffers are full are dropped immediately to avoid blocking.
func (b *Broadcaster) fanOut(data []byte) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for c := range b.clients {
		select {
		case c.send <- data:
		default:
			// Client is too slow; drop it.
			slog.Warn("dropping slow client")
			go b.Unregister(c)
		}
	}
}
