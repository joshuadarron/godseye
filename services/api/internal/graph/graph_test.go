package graph_test

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// testClient is nil when no Docker daemon is available. Tests that need a live
// graph call requireGraph (directly, or via clearGraph) and skip in that case,
// so `go test ./...` still works on a machine without Docker.
var testClient *graph.Client

func TestMain(m *testing.M) {
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "memgraph/memgraph:latest",
		ExposedPorts: []string{"7687/tcp"},
		WaitingFor:   wait.ForListeningPort("7687/tcp").WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		// No Docker daemon, no image, no network — none of these are test
		// failures. Leave testClient nil and let the tests skip themselves.
		log.Printf("memgraph container unavailable, skipping graph tests: %v", err)
		os.Exit(m.Run())
	}

	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "7687")
	boltURL := fmt.Sprintf("bolt://%s:%s", host, port.Port())

	testClient, err = graph.NewClient(boltURL, "", "")
	if err != nil {
		log.Fatalf("create graph client: %v", err)
	}

	if err := testClient.VerifyConnectivity(ctx); err != nil {
		log.Fatalf("verify connectivity: %v", err)
	}

	if err := testClient.InitSchema(ctx); err != nil {
		log.Fatalf("init schema: %v", err)
	}

	code := m.Run()

	testClient.Close(ctx)
	container.Terminate(ctx)
	os.Exit(code)
}

// requireGraph skips the calling test when no Memgraph container was started.
func requireGraph(t *testing.T) {
	t.Helper()
	if testClient == nil {
		t.Skip("memgraph container unavailable (needs a running Docker daemon); skipping graph test")
	}
}

// clearGraph removes all nodes and edges between tests.
func clearGraph(t *testing.T) {
	t.Helper()
	requireGraph(t)
	ctx := context.Background()
	session := testClient.Session(ctx)
	defer session.Close(ctx)
	_, err := session.Run(ctx, "MATCH (n) DETACH DELETE n", nil)
	if err != nil {
		t.Fatalf("clear graph: %v", err)
	}
}

// countNodes returns number of nodes with the given label.
func countNodes(t *testing.T, label string) int64 {
	t.Helper()
	ctx := context.Background()
	session := testClient.Session(ctx)
	defer session.Close(ctx)
	result, err := session.Run(ctx, "MATCH (n:"+label+") RETURN count(n)", nil)
	if err != nil {
		t.Fatalf("count nodes: %v", err)
	}
	if !result.Next(ctx) {
		return 0
	}
	return result.Record().Values[0].(int64)
}

// countEdges returns number of NEAR edges.
func countEdges(t *testing.T) int64 {
	t.Helper()
	ctx := context.Background()
	session := testClient.Session(ctx)
	defer session.Close(ctx)
	result, err := session.Run(ctx, "MATCH ()-[r:NEAR]-() RETURN count(r)", nil)
	if err != nil {
		t.Fatalf("count edges: %v", err)
	}
	if !result.Next(ctx) {
		return 0
	}
	return result.Record().Values[0].(int64)
}
