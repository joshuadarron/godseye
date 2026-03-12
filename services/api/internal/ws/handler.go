package ws

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/joshuaferrara/godseye/services/api/internal/broadcast"
	"nhooyr.io/websocket"
)

// Handler returns an http.HandlerFunc that upgrades connections to WebSocket,
// registers them with the Broadcaster, and starts read/write pumps.
func Handler(b *broadcast.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true, // Allow connections from any origin during development.
		})
		if err != nil {
			slog.Error("websocket accept failed", "error", err)
			return
		}

		client := broadcast.NewClient(conn, b)
		b.Register(client)

		ctx := r.Context()

		// Derive a cancellable context so either pump can trigger cleanup.
		pumpCtx, cancel := context.WithCancel(ctx)

		go func() {
			defer cancel()
			client.WritePump(pumpCtx)
		}()

		// ReadPump blocks until the client disconnects.
		client.ReadPump(pumpCtx)
		cancel()
	}
}
