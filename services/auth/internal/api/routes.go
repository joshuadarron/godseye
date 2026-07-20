package api

import (
	"net/http"

	"github.com/joshuaferrara/godseye/services/auth/internal/handlers"
)

// RegisterRoutes adds auth endpoints to the given mux.
func RegisterRoutes(mux *http.ServeMux, authHandler *handlers.AuthHandler, oauthHandler *handlers.OAuthHandler) {
	mux.HandleFunc("POST /auth/register", authHandler.Register)
	mux.HandleFunc("POST /auth/login", authHandler.Login)
	mux.HandleFunc("POST /auth/refresh", authHandler.Refresh)
	mux.HandleFunc("POST /auth/logout", authHandler.Logout)
	mux.HandleFunc("GET /auth/me", authHandler.Me)

	mux.HandleFunc("POST /auth/oauth/exchange", oauthHandler.Exchange)

	mux.HandleFunc("GET /auth/github", oauthHandler.GithubLogin)
	mux.HandleFunc("GET /auth/github/callback", oauthHandler.GithubCallback)
	mux.HandleFunc("GET /auth/google", oauthHandler.GoogleLogin)
	mux.HandleFunc("GET /auth/google/callback", oauthHandler.GoogleCallback)
}
