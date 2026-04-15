package graph_test

import (
	"context"
	"testing"
	"time"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
)

func TestGetNearby_ReturnsResults(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Create anchor + two nearby flights.
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-001", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, Heading: 90, Altitude: 10000, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-002", Type: graph.EntityFlight,
		Lat: 0.1, Lng: 0.0, Heading: 180, Altitude: 11000, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-003", Type: graph.EntityFlight,
		Lat: 0.2, Lng: 0.0, Heading: 270, Altitude: 12000, UpdatedAt: time.Now(),
	})

	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "q-001", graph.DefaultProximityConfig)
	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "q-002", graph.DefaultProximityConfig)

	nearby, err := testClient.GetNearby(ctx, "q-001", 1)
	if err != nil {
		t.Fatalf("GetNearby: %v", err)
	}

	if len(nearby) < 2 {
		t.Fatalf("expected at least 2 nearby entities, got %d", len(nearby))
	}

	// Verify fields populated.
	for _, n := range nearby {
		if n.ID == "" || n.Type == "" {
			t.Errorf("empty field in nearby entity: %+v", n)
		}
	}
}

func TestGetNearby_NoResults(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-010", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})

	nearby, err := testClient.GetNearby(ctx, "q-010", 1)
	if err != nil {
		t.Fatalf("GetNearby: %v", err)
	}
	if len(nearby) != 0 {
		t.Fatalf("expected 0 results for isolated entity, got %d", len(nearby))
	}
}

func TestGetNearby_NonexistentEntity(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	nearby, err := testClient.GetNearby(ctx, "doesnt-exist", 1)
	if err != nil {
		t.Fatalf("GetNearby: %v", err)
	}
	if len(nearby) != 0 {
		t.Fatalf("expected 0 results for nonexistent entity, got %d", len(nearby))
	}
}

func TestGetEncounters_AllEdges(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-020", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-021", Type: graph.EntityFlight,
		Lat: 0.1, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-022", Type: graph.EntityVessel,
		Lat: 0.05, Lng: 0.0, UpdatedAt: time.Now(),
	})

	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "q-020", graph.DefaultProximityConfig)
	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "q-021", graph.DefaultProximityConfig)

	pairs, err := testClient.GetEncounters(ctx, nil)
	if err != nil {
		t.Fatalf("GetEncounters: %v", err)
	}

	if len(pairs) == 0 {
		t.Fatal("expected encounter pairs")
	}

	// Verify pair structure.
	for _, p := range pairs {
		if p.SourceID == "" || p.TargetID == "" {
			t.Errorf("empty ID in encounter pair: %+v", p)
		}
	}
}

func TestGetEncounters_FilterByType(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-030", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-031", Type: graph.EntityFlight,
		Lat: 0.1, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-032", Type: graph.EntityVessel,
		Lat: 10.0, Lng: 20.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "q-033", Type: graph.EntityVessel,
		Lat: 10.05, Lng: 20.0, UpdatedAt: time.Now(),
	})

	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "q-030", graph.DefaultProximityConfig)
	testClient.RecomputeProximityEdges(ctx, graph.EntityVessel, "q-032", graph.DefaultProximityConfig)

	// Filter to flights only.
	flightType := graph.EntityFlight
	flightPairs, err := testClient.GetEncounters(ctx, &flightType)
	if err != nil {
		t.Fatalf("GetEncounters(Flight): %v", err)
	}

	vesselType := graph.EntityVessel
	vesselPairs, err := testClient.GetEncounters(ctx, &vesselType)
	if err != nil {
		t.Fatalf("GetEncounters(Vessel): %v", err)
	}

	// Both filters should return results (flights and vessels are far apart).
	if len(flightPairs) == 0 {
		t.Fatal("expected flight encounter pairs")
	}
	if len(vesselPairs) == 0 {
		t.Fatal("expected vessel encounter pairs")
	}
}

func TestGetEncounters_EmptyGraph(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	pairs, err := testClient.GetEncounters(ctx, nil)
	if err != nil {
		t.Fatalf("GetEncounters: %v", err)
	}
	if len(pairs) != 0 {
		t.Fatalf("expected 0 encounters in empty graph, got %d", len(pairs))
	}
}
