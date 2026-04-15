package graph_test

import (
	"context"
	"testing"
	"time"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
)

func TestUpsertEntity_CreatesNode(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	err := testClient.UpsertEntity(ctx, graph.EntityNode{
		ID:        "f-001",
		Type:      graph.EntityFlight,
		Lat:       40.7128,
		Lng:       -74.0060,
		Heading:   90,
		Altitude:  10000,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	if n := countNodes(t, "Flight"); n != 1 {
		t.Fatalf("expected 1 Flight node, got %d", n)
	}
}

func TestUpsertEntity_UpdatesExisting(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	node := graph.EntityNode{
		ID:        "f-002",
		Type:      graph.EntityFlight,
		Lat:       51.5074,
		Lng:       -0.1278,
		Heading:   180,
		Altitude:  5000,
		UpdatedAt: time.Now(),
	}
	testClient.UpsertEntity(ctx, node)

	// Update position.
	node.Lat = 52.0
	node.Altitude = 6000
	testClient.UpsertEntity(ctx, node)

	// Should still be 1 node, not 2.
	if n := countNodes(t, "Flight"); n != 1 {
		t.Fatalf("expected 1 Flight node after update, got %d", n)
	}

	// Verify updated values.
	session := testClient.Session(ctx)
	defer session.Close(ctx)
	result, _ := session.Run(ctx, "MATCH (n:Flight {id: 'f-002'}) RETURN n.lat, n.altitude", nil)
	if !result.Next(ctx) {
		t.Fatal("node not found after update")
	}
	lat := result.Record().Values[0].(float64)
	alt := result.Record().Values[1].(float64)
	if lat != 52.0 {
		t.Fatalf("expected lat 52.0, got %f", lat)
	}
	if alt != 6000 {
		t.Fatalf("expected altitude 6000, got %f", alt)
	}
}

func TestRemoveEntity_DeletesNodeAndEdges(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Create two nearby flights.
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "f-010", Type: graph.EntityFlight,
		Lat: 40.0, Lng: -74.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "f-011", Type: graph.EntityFlight,
		Lat: 40.1, Lng: -74.0, UpdatedAt: time.Now(),
	})

	// Create NEAR edge between them.
	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "f-010", graph.DefaultProximityConfig)

	if countEdges(t) == 0 {
		t.Fatal("expected at least one NEAR edge before removal")
	}

	// Remove one entity.
	if err := testClient.RemoveEntity(ctx, graph.EntityFlight, "f-010"); err != nil {
		t.Fatalf("remove: %v", err)
	}

	if n := countNodes(t, "Flight"); n != 1 {
		t.Fatalf("expected 1 remaining Flight node, got %d", n)
	}
	if e := countEdges(t); e != 0 {
		t.Fatalf("expected 0 edges after removal, got %d", e)
	}
}

func TestRemoveEntity_Nonexistent(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Removing a nonexistent entity should not error.
	if err := testClient.RemoveEntity(ctx, graph.EntityFlight, "doesnt-exist"); err != nil {
		t.Fatalf("remove nonexistent: %v", err)
	}
}
