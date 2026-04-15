package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/joshuaferrara/godseye/services/api/internal/graph"
)

type graphHandler struct {
	client *graph.Client
}

// nearby handles GET /api/graph/nearby?id={entityId}&hops={1}
func (h *graphHandler) nearby(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	hops := 1
	if v := r.URL.Query().Get("hops"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 3 {
			hops = n
		}
	}

	entities, err := h.client.GetNearby(r.Context(), id, hops)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=5")
	json.NewEncoder(w).Encode(entities)
}

// encounters handles GET /api/graph/encounters?type={flights|satellites|vessels}
func (h *graphHandler) encounters(w http.ResponseWriter, r *http.Request) {
	var entityType *graph.EntityType
	if t := r.URL.Query().Get("type"); t != "" {
		et := layerToEntityType(t)
		if et != "" {
			entityType = &et
		}
	}

	pairs, err := h.client.GetEncounters(r.Context(), entityType)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=5")
	json.NewEncoder(w).Encode(pairs)
}

func layerToEntityType(layer string) graph.EntityType {
	switch layer {
	case "flights":
		return graph.EntityFlight
	case "satellites":
		return graph.EntitySatellite
	case "vessels":
		return graph.EntityVessel
	}
	return ""
}
