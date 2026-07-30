package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-not-a-real-key"

// signToken builds an HS256 token with the given claims and secret. It mirrors
// what the auth service's GenerateAccessToken produces, without importing that
// module (the api module does not depend on it).
func signToken(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"uid":   "user-123",
		"email": "pilot@example.com",
		"name":  "Test Pilot",
		"iss":   "godseye-auth",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
	}
}

// okHandler records that the request reached the far side of the middleware and
// captures the claims the middleware attached to the context.
func okHandler(reached *bool, got **UserClaims) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*reached = true
		*got = GetUserClaims(r.Context())
		w.WriteHeader(http.StatusOK)
	})
}

func TestAuthRejectsBadTokens(t *testing.T) {
	expired := validClaims()
	expired["exp"] = time.Now().Add(-1 * time.Minute).Unix()

	// An unsigned "alg: none" token. The middleware must refuse it rather than
	// trusting its claims — this is the classic JWT algorithm-confusion attack.
	noneToken := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
	noneSigned, err := noneToken.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none-alg token: %v", err)
	}

	tests := []struct {
		name   string
		header string
	}{
		{"missing header", ""},
		{"no bearer prefix", signToken(t, testSecret, validClaims())},
		{"wrong scheme", "Basic " + signToken(t, testSecret, validClaims())},
		{"lowercase bearer", "bearer " + signToken(t, testSecret, validClaims())},
		{"empty token after prefix", "Bearer "},
		{"malformed token", "Bearer not.a.jwt"},
		{"signed with a different secret", "Bearer " + signToken(t, "some-other-secret", validClaims())},
		{"expired token", "Bearer " + signToken(t, testSecret, expired)},
		{"alg none", "Bearer " + noneSigned},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reached := false
			var got *UserClaims

			req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()

			Auth(testSecret)(okHandler(&reached, &got)).ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
			}
			if reached {
				t.Error("request reached the protected handler; it should have been blocked")
			}
		})
	}
}

func TestAuthAcceptsValidTokenAndAttachesClaims(t *testing.T) {
	reached := false
	var got *UserClaims

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+signToken(t, testSecret, validClaims()))
	rec := httptest.NewRecorder()

	Auth(testSecret)(okHandler(&reached, &got)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !reached {
		t.Fatal("request did not reach the protected handler")
	}
	if got == nil {
		t.Fatal("no claims attached to the request context")
	}
	if got.UserID != "user-123" {
		t.Errorf("UserID = %q, want %q", got.UserID, "user-123")
	}
	if got.Email != "pilot@example.com" {
		t.Errorf("Email = %q, want %q", got.Email, "pilot@example.com")
	}
	if got.Name != "Test Pilot" {
		t.Errorf("Name = %q, want %q", got.Name, "Test Pilot")
	}
}

func TestGetUserClaimsWithoutMiddleware(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	if claims := GetUserClaims(req.Context()); claims != nil {
		t.Errorf("expected nil claims on a bare context, got %+v", claims)
	}
}

func TestGetUserClaimsFromToken(t *testing.T) {
	expired := validClaims()
	expired["exp"] = time.Now().Add(-1 * time.Minute).Unix()

	t.Run("valid token", func(t *testing.T) {
		claims := GetUserClaimsFromToken(testSecret, signToken(t, testSecret, validClaims()))
		if claims == nil {
			t.Fatal("expected claims, got nil")
		}
		if claims.UserID != "user-123" {
			t.Errorf("UserID = %q, want %q", claims.UserID, "user-123")
		}
	})

	invalid := map[string]string{
		"empty string":  "",
		"malformed":     "not.a.jwt",
		"wrong secret":  signToken(t, "some-other-secret", validClaims()),
		"expired token": signToken(t, testSecret, expired),
	}
	for name, token := range invalid {
		t.Run(name, func(t *testing.T) {
			if claims := GetUserClaimsFromToken(testSecret, token); claims != nil {
				t.Errorf("expected nil claims, got %+v", claims)
			}
		})
	}
}

func TestGetUserClaimsFromTokenMissingClaims(t *testing.T) {
	// A token carrying no identity claims is still cryptographically valid, so
	// it is accepted — but every field comes back empty rather than panicking on
	// the type assertions in claimString.
	claims := GetUserClaimsFromToken(testSecret, signToken(t, testSecret, jwt.MapClaims{
		"exp": time.Now().Add(15 * time.Minute).Unix(),
	}))
	if claims == nil {
		t.Fatal("expected claims, got nil")
	}
	if claims.UserID != "" || claims.Email != "" || claims.Name != "" {
		t.Errorf("expected all-empty claims, got %+v", claims)
	}
}

func TestClaimStringIgnoresNonStringValues(t *testing.T) {
	claims := jwt.MapClaims{
		"uid":   12345,
		"email": nil,
		"name":  "Real Name",
	}

	if got := claimString(claims, "uid"); got != "" {
		t.Errorf("numeric claim: got %q, want empty string", got)
	}
	if got := claimString(claims, "email"); got != "" {
		t.Errorf("nil claim: got %q, want empty string", got)
	}
	if got := claimString(claims, "missing"); got != "" {
		t.Errorf("absent claim: got %q, want empty string", got)
	}
	if got := claimString(claims, "name"); got != "Real Name" {
		t.Errorf("string claim: got %q, want %q", got, "Real Name")
	}
}
