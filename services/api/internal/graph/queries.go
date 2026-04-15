package graph

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// NearbyEntity is a graph node returned by proximity queries.
type NearbyEntity struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Heading  float64 `json:"heading"`
	Altitude float64 `json:"altitude"`
	DistKm   float64 `json:"distKm"`
}

// GetNearby returns all entities within N hops of a given entity via NEAR edges.
func (c *Client) GetNearby(ctx context.Context, id string, maxHops int) ([]NearbyEntity, error) {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := fmt.Sprintf(`
MATCH (a {id: $id})-[r:NEAR*1..%d]-(b)
RETURN b.id AS id,
       labels(b)[0] AS type,
       b.lat AS lat,
       b.lng AS lng,
       b.heading AS heading,
       b.altitude AS altitude,
       r[-1].distKm AS distKm
ORDER BY distKm ASC
LIMIT 50
`, maxHops)

	result, err := session.Run(ctx, query, map[string]any{"id": id})
	if err != nil {
		return nil, err
	}

	var entities []NearbyEntity
	for result.Next(ctx) {
		record := result.Record()
		entities = append(entities, NearbyEntity{
			ID:       stringVal(record.Values[0]),
			Type:     stringVal(record.Values[1]),
			Lat:      floatVal(record.Values[2]),
			Lng:      floatVal(record.Values[3]),
			Heading:  floatVal(record.Values[4]),
			Altitude: floatVal(record.Values[5]),
			DistKm:   floatVal(record.Values[6]),
		})
	}
	return entities, result.Err()
}

// EncounterPair represents a NEAR edge between two entities.
type EncounterPair struct {
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	DistKm   float64 `json:"distKm"`
}

// GetEncounters returns all current NEAR edges in the graph.
func (c *Client) GetEncounters(ctx context.Context, entityType *EntityType) ([]EncounterPair, error) {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	var query string
	if entityType != nil {
		query = `MATCH (a:` + string(*entityType) + `)-[r:NEAR]-(b) RETURN a.id, b.id, r.distKm`
	} else {
		query = `MATCH (a)-[r:NEAR]-(b) RETURN a.id, b.id, r.distKm`
	}

	result, err := session.Run(ctx, query, nil)
	if err != nil {
		return nil, err
	}

	var pairs []EncounterPair
	for result.Next(ctx) {
		record := result.Record()
		pairs = append(pairs, EncounterPair{
			SourceID: stringVal(record.Values[0]),
			TargetID: stringVal(record.Values[1]),
			DistKm:   floatVal(record.Values[2]),
		})
	}
	return pairs, result.Err()
}

func stringVal(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func floatVal(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	}
	return 0
}
