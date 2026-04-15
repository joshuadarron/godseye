package graph_test

import (
	"context"
	"testing"
	"time"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
)

func TestProximity_WithinThreshold(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Two flights ~11 km apart (0.1 degrees lat at equator).
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-001", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-002", Type: graph.EntityFlight,
		Lat: 0.1, Lng: 0.0, UpdatedAt: time.Now(),
	})

	err := testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "p-001", graph.DefaultProximityConfig)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}

	if e := countEdges(t); e == 0 {
		t.Fatal("expected NEAR edge between nearby flights")
	}
}

func TestProximity_OutsideThreshold(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Two flights ~1100 km apart (10 degrees lat).
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-010", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-011", Type: graph.EntityFlight,
		Lat: 10.0, Lng: 0.0, UpdatedAt: time.Now(),
	})

	err := testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "p-010", graph.DefaultProximityConfig)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}

	if e := countEdges(t); e != 0 {
		t.Fatalf("expected no NEAR edge for distant flights, got %d", e)
	}
}

func TestProximity_CrossType_FlightVessel(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-020", Type: graph.EntityFlight,
		Lat: 35.0, Lng: 139.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-021", Type: graph.EntityVessel,
		Lat: 35.05, Lng: 139.0, UpdatedAt: time.Now(),
	})

	err := testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "p-020", graph.DefaultProximityConfig)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}

	if e := countEdges(t); e == 0 {
		t.Fatal("expected NEAR edge between flight and nearby vessel")
	}
}

func TestProximity_RecomputeDropsStaleEdges(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	// Create two nearby flights.
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-030", Type: graph.EntityFlight,
		Lat: 0.0, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-031", Type: graph.EntityFlight,
		Lat: 0.1, Lng: 0.0, UpdatedAt: time.Now(),
	})
	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "p-030", graph.DefaultProximityConfig)

	if countEdges(t) == 0 {
		t.Fatal("setup: expected edge")
	}

	// Move p-031 far away and recompute for p-030.
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "p-031", Type: graph.EntityFlight,
		Lat: 50.0, Lng: 50.0, UpdatedAt: time.Now(),
	})
	testClient.RecomputeProximityEdges(ctx, graph.EntityFlight, "p-030", graph.DefaultProximityConfig)

	if e := countEdges(t); e != 0 {
		t.Fatalf("expected stale edge removed, got %d edges", e)
	}
}

func TestProximity_VesselVessel(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "v-001", Type: graph.EntityVessel,
		Lat: 10.0, Lng: 20.0, UpdatedAt: time.Now(),
	})
	testClient.UpsertEntity(ctx, graph.EntityNode{
		ID: "v-002", Type: graph.EntityVessel,
		Lat: 10.05, Lng: 20.0, UpdatedAt: time.Now(),
	})

	err := testClient.RecomputeProximityEdges(ctx, graph.EntityVessel, "v-001", graph.DefaultProximityConfig)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}

	if e := countEdges(t); e == 0 {
		t.Fatal("expected NEAR edge between nearby vessels")
	}
}
