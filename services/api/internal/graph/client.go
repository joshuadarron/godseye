package graph

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Client wraps a Neo4j/Memgraph Bolt driver. All graph interaction goes through this type.
type Client struct {
	driver neo4j.DriverWithContext
}

func NewClient(boltURL, user, password string) (*Client, error) {
	driver, err := neo4j.NewDriverWithContext(
		boltURL,
		neo4j.BasicAuth(user, password, ""),
	)
	if err != nil {
		return nil, fmt.Errorf("graph: failed to create driver: %w", err)
	}
	return &Client{driver: driver}, nil
}

func (c *Client) Close(ctx context.Context) error {
	return c.driver.Close(ctx)
}

func (c *Client) Session(ctx context.Context) neo4j.SessionWithContext {
	return c.driver.NewSession(ctx, neo4j.SessionConfig{
		AccessMode: neo4j.AccessModeWrite,
	})
}

func (c *Client) VerifyConnectivity(ctx context.Context) error {
	return c.driver.VerifyConnectivity(ctx)
}
