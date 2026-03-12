package models

// DeltaMessage represents a WebSocket delta payload sent to clients.
type DeltaMessage struct {
	Layer    string `json:"layer"`
	Action   string `json:"action"` // "upsert" or "remove"
	Entities []any  `json:"entities"`
}
