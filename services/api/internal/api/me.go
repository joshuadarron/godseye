package api

import (
	"encoding/json"
	"net/http"

	"github.com/joshuaferrara/godseye/services/api/internal/middleware"
)

type meResponse struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Name   string `json:"name"`
}

// me handles GET /api/me — returns the authenticated caller's identity as
// carried by the access token. It is the anchor for the /api/me/* routes that
// hold per-user state, and doubles as a live check that this service shares
// JWT_SECRET with the auth service.
func me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r.Context())
	if claims == nil {
		// Unreachable behind middleware.Auth, but the handler must not assume it.
		http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(meResponse{
		UserID: claims.UserID,
		Email:  claims.Email,
		Name:   claims.Name,
	})
}
