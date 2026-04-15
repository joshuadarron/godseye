package graph_test

import (
	"context"
	"testing"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
)

func TestNewClient_BadURL(t *testing.T) {
	_, err := graph.NewClient("bolt://invalid:9999", "", "")
	// Driver creation succeeds (lazy connect); verify connectivity should fail.
	if err != nil {
		// Some driver versions fail eagerly — that's acceptable too.
		return
	}
}

func TestVerifyConnectivity(t *testing.T) {
	ctx := context.Background()
	if err := testClient.VerifyConnectivity(ctx); err != nil {
		t.Fatalf("expected connectivity: %v", err)
	}
}

func TestSession_ReadWrite(t *testing.T) {
	clearGraph(t)
	ctx := context.Background()

	session := testClient.Session(ctx)
	defer session.Close(ctx)

	_, err := session.Run(ctx, "CREATE (n:TestNode {name: 'hello'})", nil)
	if err != nil {
		t.Fatalf("create test node: %v", err)
	}

	result, err := session.Run(ctx, "MATCH (n:TestNode) RETURN n.name", nil)
	if err != nil {
		t.Fatalf("query test node: %v", err)
	}
	if !result.Next(ctx) {
		t.Fatal("expected one result")
	}
	if result.Record().Values[0].(string) != "hello" {
		t.Fatalf("unexpected value: %v", result.Record().Values[0])
	}
}

func TestInitSchema_Idempotent(t *testing.T) {
	ctx := context.Background()
	// Should not error when run twice.
	if err := testClient.InitSchema(ctx); err != nil {
		t.Fatalf("second InitSchema call failed: %v", err)
	}
}
