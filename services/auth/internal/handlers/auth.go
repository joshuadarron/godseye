package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/joshuaferrara/godseye/services/auth/internal/config"
	authjwt "github.com/joshuaferrara/godseye/services/auth/internal/jwt"
	"github.com/joshuaferrara/godseye/services/auth/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	cfg       *config.Config
	userRepo  *repository.UserRepo
	tokenRepo *repository.TokenRepo
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(cfg *config.Config, userRepo *repository.UserRepo, tokenRepo *repository.TokenRepo) *AuthHandler {
	return &AuthHandler{cfg: cfg, userRepo: userRepo, tokenRepo: tokenRepo}
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type authResponse struct {
	AccessToken  string          `json:"accessToken"`
	RefreshToken string          `json:"refreshToken"`
	User         *repository.User `json:"user"`
}

// Register handles POST /auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email, password, and name are required"})
		return
	}

	if !isValidEmail(req.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email format"})
		return
	}

	if len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	existing, err := h.userRepo.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		slog.Error("register: check existing user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if existing != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		slog.Error("register: hash password", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	user, err := h.userRepo.CreateUser(r.Context(), req.Email, string(hash), req.Name, "local", "")
	if err != nil {
		slog.Error("register: create user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	h.issueTokens(w, r, user)
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password are required"})
		return
	}

	if !isValidEmail(req.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email format"})
		return
	}

	user, err := h.userRepo.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		slog.Error("login: get user", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	h.issueTokens(w, r, user)
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.RefreshToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "refreshToken is required"})
		return
	}

	tokenHash := authjwt.HashToken(req.RefreshToken)

	stored, err := h.tokenRepo.GetRefreshToken(r.Context(), tokenHash)
	if err != nil {
		slog.Error("refresh: get token", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if stored == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired refresh token"})
		return
	}

	// Rotation: delete the used token.
	if err := h.tokenRepo.DeleteRefreshToken(r.Context(), tokenHash); err != nil {
		slog.Error("refresh: delete old token", "error", err)
	}

	user, err := h.userRepo.GetUserByID(r.Context(), stored.UserID)
	if err != nil || user == nil {
		slog.Error("refresh: get user", "error", err)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
		return
	}

	h.issueTokens(w, r, user)
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.RefreshToken != "" {
		tokenHash := authjwt.HashToken(req.RefreshToken)
		if err := h.tokenRepo.DeleteRefreshToken(r.Context(), tokenHash); err != nil {
			slog.Error("logout: delete token", "error", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /auth/me.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing or invalid authorization header"})
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := authjwt.ValidateAccessToken(h.cfg.JWTSecret, tokenStr)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
		return
	}

	user, err := h.userRepo.GetUserByID(r.Context(), claims.UserID)
	if err != nil || user == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

// issueTokens generates and returns access + refresh tokens for the user.
func (h *AuthHandler) issueTokens(w http.ResponseWriter, r *http.Request, user *repository.User) {
	accessToken, err := authjwt.GenerateAccessToken(h.cfg.JWTSecret, h.cfg.AccessTokenTTL, user.ID, user.Email, user.Name)
	if err != nil {
		slog.Error("issue tokens: generate access token", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	rawRefresh, hashRefresh, err := authjwt.GenerateRefreshToken()
	if err != nil {
		slog.Error("issue tokens: generate refresh token", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	expiresAt := time.Now().Add(h.cfg.RefreshTokenTTL)
	if err := h.tokenRepo.StoreRefreshToken(r.Context(), user.ID, hashRefresh, expiresAt); err != nil {
		slog.Error("issue tokens: store refresh token", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		User:         user,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
