package graph

import (
	"context"
	"time"
)

// EntityType labels for graph nodes.
type EntityType string

const (
	EntityFlight    EntityType = "Flight"
	EntitySatellite EntityType = "Satellite"
	EntityVessel    EntityType = "Vessel"
)

// EntityNode is the data written to a graph node.
type EntityNode struct {
	ID        string
	Type      EntityType
	Lat       float64
	Lng       float64
	Heading   float64
	Altitude  float64
	UpdatedAt time.Time
}

// UpsertEntity merges an entity node by ID. Creates if not exists, updates if exists.
func (c *Client) UpsertEntity(ctx context.Context, e EntityNode) error {
	session := c.Session(ctx)
	defer session.Close(ctx)

	query := `
MERGE (n:` + string(e.Type) + ` {id: $id})
SET n.lat = $lat,
    n.lng = $lng,
    n.heading = $heading,
    n.altitude = $altitude,
    n.updatedAt = $updatedAt
`
	_, err := session.Run(ctx, query, map[string]any{
		"id":        e.ID,
		"lat":       e.Lat,
		"lng":       e.Lng,
		"heading":   e.Heading,
		"altitude":  e.Altitude,
		"updatedAt": e.UpdatedAt.UnixMilli(),
	})
	return err
}

// RemoveEntity deletes an entity node and all its edges.
func (c *Client) RemoveEntity(ctx context.Context, entityType EntityType, id string) error {
	session := c.Session(ctx)
	defer session.Close(ctx)

	query := `MATCH (n:` + string(entityType) + ` {id: $id}) DETACH DELETE n`
	_, err := session.Run(ctx, query, map[string]any{"id": id})
	return err
}
