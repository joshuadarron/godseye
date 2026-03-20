package models

import (
	"encoding/json"
	"testing"
)

func TestDeltaMessageJSON(t *testing.T) {
	msg := DeltaMessage{
		Layer:    "flights",
		Action:   "upsert",
		Entities: []any{"entity1", "entity2"},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal DeltaMessage: %v", err)
	}

	var decoded DeltaMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal DeltaMessage: %v", err)
	}

	if decoded.Layer != "flights" {
		t.Errorf("expected layer 'flights', got %q", decoded.Layer)
	}
	if decoded.Action != "upsert" {
		t.Errorf("expected action 'upsert', got %q", decoded.Action)
	}
	if len(decoded.Entities) != 2 {
		t.Errorf("expected 2 entities, got %d", len(decoded.Entities))
	}
}

func TestDeltaMessageRemoveAction(t *testing.T) {
	msg := DeltaMessage{
		Layer:    "vessels",
		Action:   "remove",
		Entities: []any{},
	}

	if msg.Action != "remove" {
		t.Errorf("expected action 'remove', got %q", msg.Action)
	}
}
