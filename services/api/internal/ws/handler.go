package ws

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/joshuaferrara/godseye/services/api/internal/broadcast"
	"github.com/joshuaferrara/godseye/services/api/internal/middleware"
	"nhooyr.io/websocket"
)

// Handler returns an http.HandlerFunc that upgrades connections to WebSocket,
// registers them with the Broadcaster, and starts read/write pumps.
//
// Authentication is attempted via the Sec-WebSocket-Protocol subprotocol header
// (format: "godseye.v1.TOKEN"), falling back to a "token" query parameter for
// backward compatibility. If absent or invalid, the connection is still accepted
// (anonymous).
func Handler(b *broadcast.Broadcaster, jwtSecret string, allowedOrigins []string) http.HandlerFunc {
	originPatterns := extractOriginHosts(allowedOrigins)

	return func(w http.ResponseWriter, r *http.Request) {
		// Determine auth token from subprotocol or query param.
		var tokenStr string
		var acceptProtocol string
		for _, proto := range parseSubprotocols(r.Header.Get("Sec-WebSocket-Protocol")) {
			if proto == "godseye.v1" {
				acceptProtocol = "godseye.v1"
			} else if strings.HasPrefix(proto, "godseye.v1.") {
				tokenStr = strings.TrimPrefix(proto, "godseye.v1.")
				acceptProtocol = proto
			}
		}

		// Fallback: query param for backward compatibility.
		if tokenStr == "" {
			tokenStr = r.URL.Query().Get("token")
		}

		opts := &websocket.AcceptOptions{
			OriginPatterns: originPatterns,
		}
		if acceptProtocol != "" {
			opts.Subprotocols = []string{acceptProtocol}
		}

		conn, err := websocket.Accept(w, r, opts)
		if err != nil {
			slog.Error("websocket accept failed", "error", err)
			return
		}

		client := broadcast.NewClient(conn, b)

		if tokenStr != "" && jwtSecret != "" {
			claims := middleware.GetUserClaimsFromToken(jwtSecret, tokenStr)
			if claims != nil {
				client.UserID = claims.UserID
				slog.Debug("websocket authenticated", "user_id", claims.UserID)
			}
		}

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

// extractOriginHosts converts full origin URLs to host patterns for nhooyr/websocket.
// OriginPatterns match against the origin request host using filepath.Match.
func extractOriginHosts(origins []string) []string {
	patterns := make([]string, 0, len(origins))
	for _, o := range origins {
		u, err := url.Parse(o)
		if err != nil {
			continue
		}
		if u.Host != "" {
			patterns = append(patterns, u.Host)
		}
	}
	if len(patterns) == 0 {
		patterns = append(patterns, "localhost:*")
	}
	return patterns
}

// parseSubprotocols parses the Sec-WebSocket-Protocol header value into a slice.
func parseSubprotocols(header string) []string {
	if header == "" {
		return nil
	}
	parts := strings.Split(header, ",")
	protocols := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			protocols = append(protocols, p)
		}
	}
	return protocols
}
