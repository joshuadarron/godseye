package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"

	"github.com/joshuaferrara/godseye/services/auth/internal/config"
	authjwt "github.com/joshuaferrara/godseye/services/auth/internal/jwt"
	"github.com/joshuaferrara/godseye/services/auth/internal/repository"
)

// OAuthHandler handles OAuth2 login flows.
type OAuthHandler struct {
	cfg       *config.Config
	userRepo  *repository.UserRepo
	tokenRepo *repository.TokenRepo

	githubCfg *oauth2.Config
	googleCfg *oauth2.Config
}

// NewOAuthHandler creates a new OAuthHandler.
func NewOAuthHandler(cfg *config.Config, userRepo *repository.UserRepo, tokenRepo *repository.TokenRepo) *OAuthHandler {
	h := &OAuthHandler{
		cfg:       cfg,
		userRepo:  userRepo,
		tokenRepo: tokenRepo,
	}

	if cfg.GithubClientID != "" {
		h.githubCfg = &oauth2.Config{
			ClientID:     cfg.GithubClientID,
			ClientSecret: cfg.GithubClientSecret,
			Endpoint:     github.Endpoint,
			RedirectURL:  fmt.Sprintf("%s/auth/github/callback", cfg.OAuthBaseURL),
			Scopes:       []string{"user:email"},
		}
	}

	if cfg.GoogleClientID != "" {
		h.googleCfg = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  fmt.Sprintf("%s/auth/google/callback", cfg.OAuthBaseURL),
			Scopes:       []string{"openid", "email", "profile"},
		}
	}

	return h
}

// GithubLogin handles GET /auth/github — redirects to GitHub authorization.
func (h *OAuthHandler) GithubLogin(w http.ResponseWriter, r *http.Request) {
	if h.githubCfg == nil {
		http.Error(w, "GitHub OAuth not configured", http.StatusNotImplemented)
		return
	}

	state, err := authjwt.GenerateStateToken(h.cfg.JWTSecret)
	if err != nil {
		slog.Error("github login: generate state", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, h.githubCfg.AuthCodeURL(state), http.StatusTemporaryRedirect)
}

// GithubCallback handles GET /auth/github/callback.
func (h *OAuthHandler) GithubCallback(w http.ResponseWriter, r *http.Request) {
	if h.githubCfg == nil {
		http.Error(w, "GitHub OAuth not configured", http.StatusNotImplemented)
		return
	}

	if err := authjwt.ValidateStateToken(h.cfg.JWTSecret, r.URL.Query().Get("state")); err != nil {
		http.Error(w, "invalid state parameter", http.StatusBadRequest)
		return
	}

	token, err := h.githubCfg.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		slog.Error("github callback: exchange code", "error", err)
		http.Error(w, "failed to exchange code", http.StatusBadRequest)
		return
	}

	profile, err := fetchGithubProfile(r.Context(), token.AccessToken)
	if err != nil {
		slog.Error("github callback: fetch profile", "error", err)
		http.Error(w, "failed to fetch profile", http.StatusInternalServerError)
		return
	}

	user, err := h.userRepo.UpsertOAuthUser(r.Context(), profile.Email, profile.Name, profile.AvatarURL, "github", profile.ID)
	if err != nil {
		slog.Error("github callback: upsert user", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	h.redirectWithTokens(w, r, user)
}

// GoogleLogin handles GET /auth/google — redirects to Google authorization.
func (h *OAuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if h.googleCfg == nil {
		http.Error(w, "Google OAuth not configured", http.StatusNotImplemented)
		return
	}

	state, err := authjwt.GenerateStateToken(h.cfg.JWTSecret)
	if err != nil {
		slog.Error("google login: generate state", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, h.googleCfg.AuthCodeURL(state), http.StatusTemporaryRedirect)
}

// GoogleCallback handles GET /auth/google/callback.
func (h *OAuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	if h.googleCfg == nil {
		http.Error(w, "Google OAuth not configured", http.StatusNotImplemented)
		return
	}

	if err := authjwt.ValidateStateToken(h.cfg.JWTSecret, r.URL.Query().Get("state")); err != nil {
		http.Error(w, "invalid state parameter", http.StatusBadRequest)
		return
	}

	token, err := h.googleCfg.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		slog.Error("google callback: exchange code", "error", err)
		http.Error(w, "failed to exchange code", http.StatusBadRequest)
		return
	}

	profile, err := fetchGoogleProfile(r.Context(), token.AccessToken)
	if err != nil {
		slog.Error("google callback: fetch profile", "error", err)
		http.Error(w, "failed to fetch profile", http.StatusInternalServerError)
		return
	}

	user, err := h.userRepo.UpsertOAuthUser(r.Context(), profile.Email, profile.Name, profile.AvatarURL, "google", profile.ID)
	if err != nil {
		slog.Error("google callback: upsert user", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	h.redirectWithTokens(w, r, user)
}

// redirectWithTokens issues tokens and redirects to the frontend callback URL.
func (h *OAuthHandler) redirectWithTokens(w http.ResponseWriter, r *http.Request, user *repository.User) {
	accessToken, err := authjwt.GenerateAccessToken(h.cfg.JWTSecret, h.cfg.AccessTokenTTL, user.ID, user.Email, user.Name)
	if err != nil {
		slog.Error("oauth: generate access token", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	rawRefresh, hashRefresh, err := authjwt.GenerateRefreshToken()
	if err != nil {
		slog.Error("oauth: generate refresh token", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	expiresAt := time.Now().Add(h.cfg.RefreshTokenTTL)
	if err := h.tokenRepo.StoreRefreshToken(r.Context(), user.ID, hashRefresh, expiresAt); err != nil {
		slog.Error("oauth: store refresh token", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// SECURITY: Tokens in redirect URL query params are visible in browser history and server logs.
	// TODO: Switch to a short-lived authorization code exchange pattern in production.
	redirectURL := fmt.Sprintf("%s/auth/callback?access_token=%s&refresh_token=%s",
		h.cfg.FrontendURL,
		url.QueryEscape(accessToken),
		url.QueryEscape(rawRefresh),
	)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

type oauthProfile struct {
	ID        string
	Email     string
	Name      string
	AvatarURL string
}

func fetchGithubProfile(ctx context.Context, accessToken string) (*oauthProfile, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch github user: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("decode github user: %w", err)
	}

	name := data.Name
	if name == "" {
		name = data.Login
	}

	email := data.Email
	if email == "" {
		email, err = fetchGithubPrimaryEmail(ctx, accessToken)
		if err != nil {
			return nil, err
		}
	}

	return &oauthProfile{
		ID:        fmt.Sprintf("%d", data.ID),
		Email:     email,
		Name:      name,
		AvatarURL: data.AvatarURL,
	}, nil
}

func fetchGithubPrimaryEmail(ctx context.Context, accessToken string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch github emails: %w", err)
	}
	defer resp.Body.Close()

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", fmt.Errorf("decode github emails: %w", err)
	}

	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}

	return "", fmt.Errorf("no verified primary email found")
}

func fetchGoogleProfile(ctx context.Context, accessToken string) (*oauthProfile, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch google user: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("decode google user: %w", err)
	}

	return &oauthProfile{
		ID:        data.ID,
		Email:     data.Email,
		Name:      data.Name,
		AvatarURL: data.Picture,
	}, nil
}
