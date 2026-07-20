package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userClaimsKey contextKey = "userClaims"

// UserClaims holds the authenticated user information extracted from a JWT.
type UserClaims struct {
	UserID string
	Email  string
	Name   string
}

// GetUserClaims retrieves the authenticated user claims from the request context.
// Returns nil if no authenticated user is present.
func GetUserClaims(ctx context.Context) *UserClaims {
	claims, _ := ctx.Value(userClaimsKey).(*UserClaims)
	return claims
}

// Auth returns middleware that validates JWT Bearer tokens.
// Requests without a valid token receive a 401 response.
//
// It is applied per-route rather than to the whole chain, because the tracking
// layers are deliberately public. Wrap user-scoped routes with it:
//
//	requireAuth := middleware.Auth(jwtSecret)
//	mux.Handle("GET /api/me", requireAuth(http.HandlerFunc(me)))
//
// The secret must match the auth service's JWT_SECRET. Never call this with an
// empty secret — HMAC validation would then accept forged tokens.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"missing or invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			userClaims := &UserClaims{
				UserID: claimString(claims, "uid"),
				Email:  claimString(claims, "email"),
				Name:   claimString(claims, "name"),
			}

			ctx := context.WithValue(r.Context(), userClaimsKey, userClaims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserClaimsFromToken validates a raw JWT string and returns UserClaims.
// Returns nil if the token is invalid. Used by the WebSocket handler for
// optional token authentication.
func GetUserClaimsFromToken(jwtSecret, tokenStr string) *UserClaims {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil
	}

	return &UserClaims{
		UserID: claimString(claims, "uid"),
		Email:  claimString(claims, "email"),
		Name:   claimString(claims, "name"),
	}
}

func claimString(claims jwt.MapClaims, key string) string {
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}
