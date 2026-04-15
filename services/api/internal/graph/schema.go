package graph

import (
	"context"
	"strings"
)

// Schema DDL statements — run once on startup to create indexes.
var schemaStatements = []string{
	"CREATE INDEX ON :Flight(id)",
	"CREATE INDEX ON :Satellite(id)",
	"CREATE INDEX ON :Vessel(id)",
	"CREATE INDEX ON :Zone(id)",
	"CREATE INDEX ON :Flight(lat)",
	"CREATE INDEX ON :Flight(lng)",
	"CREATE INDEX ON :Satellite(lat)",
	"CREATE INDEX ON :Satellite(lng)",
	"CREATE INDEX ON :Vessel(lat)",
	"CREATE INDEX ON :Vessel(lng)",
}

// InitSchema creates required indexes. Safe to call multiple times —
// Memgraph ignores duplicate index creation.
func (c *Client) InitSchema(ctx context.Context) error {
	session := c.Session(ctx)
	defer session.Close(ctx)

	for _, stmt := range schemaStatements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := session.Run(ctx, stmt, nil); err != nil {
			// Memgraph returns an error for duplicate indexes; ignore it.
			if !strings.Contains(err.Error(), "already exists") {
				return err
			}
		}
	}
	return nil
}
