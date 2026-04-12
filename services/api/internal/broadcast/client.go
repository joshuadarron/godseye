package broadcast

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/joshuaferrara/godseye/services/api/internal/models"

	"nhooyr.io/websocket"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	b      *Broadcaster
	bounds atomic.Pointer[models.ViewportBounds]

	// UserID is the authenticated user's ID, if a valid token was provided
	// during the WebSocket upgrade. Empty string means anonymous.
	UserID string
}

// NewClient creates a new Client with a buffered send channel.
func NewClient(conn *websocket.Conn, b *Broadcaster) *Client {
	return &Client{
		conn: conn,
		send: make(chan []byte, 256),
		b:    b,
	}
}

// Bounds returns the client's current viewport bounds, or nil if not yet reported.
func (c *Client) Bounds() *models.ViewportBounds {
	return c.bounds.Load()
}

// WritePump reads messages from the send channel and writes them to the WebSocket connection.
func (c *Client) WritePump(ctx context.Context) {
	defer func() {
		c.conn.Close(websocket.StatusNormalClosure, "write pump exiting")
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-c.send:
			if !ok {
				// Send channel was closed.
				return
			}

			writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := c.conn.Write(writeCtx, websocket.MessageText, msg)
			cancel()

			if err != nil {
				slog.Warn("failed to write to websocket", "error", err)
				return
			}
		}
	}
}

// ReadPump reads messages from the WebSocket connection and processes client commands.
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.b.Unregister(c)
		c.conn.Close(websocket.StatusNormalClosure, "read pump exiting")
	}()

	c.conn.SetReadLimit(64 * 1024) // 64 KB max message size from clients.

	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			// Client disconnected or error occurred.
			slog.Debug("client read error, disconnecting", "error", err)
			return
		}

		// Parse incoming messages to handle viewport updates.
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(data, &envelope); err != nil {
			continue
		}

		switch envelope.Type {
		case "viewport":
			var msg models.ViewportMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				slog.Warn("failed to parse viewport message", "error", err)
				continue
			}
			b := msg.Bounds
			c.bounds.Store(&b)
			slog.Debug("client viewport updated",
				"west", b.West, "south", b.South,
				"east", b.East, "north", b.North)
		}
	}
}
