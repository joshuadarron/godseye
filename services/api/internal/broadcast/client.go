package broadcast

import (
	"context"
	"log/slog"
	"time"

	"nhooyr.io/websocket"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn *websocket.Conn
	send chan []byte
	b    *Broadcaster
}

// NewClient creates a new Client with a buffered send channel.
func NewClient(conn *websocket.Conn, b *Broadcaster) *Client {
	return &Client{
		conn: conn,
		send: make(chan []byte, 256),
		b:    b,
	}
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

// ReadPump reads messages from the WebSocket connection.
// Currently only used to detect client disconnection.
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.b.Unregister(c)
		c.conn.Close(websocket.StatusNormalClosure, "read pump exiting")
	}()

	for {
		_, _, err := c.conn.Read(ctx)
		if err != nil {
			// Client disconnected or error occurred.
			slog.Debug("client read error, disconnecting", "error", err)
			return
		}
	}
}
