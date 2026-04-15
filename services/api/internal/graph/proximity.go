package graph

import (
	"context"
)

// ProximityConfig defines thresholds in kilometers for each entity-pair combination.
type ProximityConfig struct {
	FlightFlight       float64 // default: 50 km
	FlightVessel       float64 // default: 100 km
	FlightSatellite    float64 // default: 500 km (altitude-adjusted)
	SatelliteSatellite float64 // default: 200 km
	VesselVessel       float64 // default: 50 km
}

// DefaultProximityConfig holds sensible defaults for proximity detection.
var DefaultProximityConfig = ProximityConfig{
	FlightFlight:       50,
	FlightVessel:       100,
	FlightSatellite:    500,
	SatelliteSatellite: 200,
	VesselVessel:       50,
}

// RecomputeProximityEdges drops and rebuilds all NEAR edges for a given entity.
func (c *Client) RecomputeProximityEdges(ctx context.Context, entityType EntityType, id string, cfg ProximityConfig) error {
	session := c.Session(ctx)
	defer session.Close(ctx)

	// Remove existing NEAR edges for this entity.
	deleteQuery := `
MATCH (a {id: $id})-[r:NEAR]-()
DELETE r
`
	if _, err := session.Run(ctx, deleteQuery, map[string]any{"id": id}); err != nil {
		return err
	}

	// Rebuild NEAR edges to all entities within threshold.
	rebuildQuery := buildProximityQuery(entityType)
	if rebuildQuery == "" {
		return nil
	}

	_, err := session.Run(ctx, rebuildQuery, map[string]any{"id": id})
	return err
}

// buildProximityQuery generates Cypher that creates NEAR edges from the anchor entity
// to all other entities within a configured radius.
// Uses flat-earth approximation (1 degree lat ≈ 111 km) sufficient for proximity detection.
func buildProximityQuery(entityType EntityType) string {
	switch entityType {
	case EntityFlight:
		return `
MATCH (a:Flight {id: $id}), (b)
WHERE (b:Flight OR b:Vessel OR b:Satellite)
  AND b.id <> $id
  AND abs(a.lat - b.lat) < 5
  AND abs(a.lng - b.lng) < 5
WITH a, b,
     111.0 * sqrt((a.lat - b.lat)^2 + (cos(a.lat * pi() / 180.0) * (a.lng - b.lng))^2) AS distKm
WHERE distKm <= 500
MERGE (a)-[r:NEAR]-(b)
SET r.distKm = distKm,
    r.updatedAt = timestamp()
`
	case EntitySatellite:
		return `
MATCH (a:Satellite {id: $id}), (b)
WHERE (b:Satellite OR b:Flight)
  AND b.id <> $id
  AND abs(a.lat - b.lat) < 5
  AND abs(a.lng - b.lng) < 5
WITH a, b,
     111.0 * sqrt((a.lat - b.lat)^2 + (cos(a.lat * pi() / 180.0) * (a.lng - b.lng))^2) AS distKm
WHERE distKm <= 500
MERGE (a)-[r:NEAR]-(b)
SET r.distKm = distKm,
    r.updatedAt = timestamp()
`
	case EntityVessel:
		return `
MATCH (a:Vessel {id: $id}), (b)
WHERE (b:Vessel OR b:Flight)
  AND b.id <> $id
  AND abs(a.lat - b.lat) < 2
  AND abs(a.lng - b.lng) < 2
WITH a, b,
     111.0 * sqrt((a.lat - b.lat)^2 + (cos(a.lat * pi() / 180.0) * (a.lng - b.lng))^2) AS distKm
WHERE distKm <= 100
MERGE (a)-[r:NEAR]-(b)
SET r.distKm = distKm,
    r.updatedAt = timestamp()
`
	}
	return ""
}
