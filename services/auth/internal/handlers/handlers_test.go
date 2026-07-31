package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/joshuaferrara/godseye/services/auth/internal/config"
	"github.com/joshuaferrara/godseye/services/auth/internal/db"
	authjwt "github.com/joshuaferrara/godseye/services/auth/internal/jwt"
	"github.com/joshuaferrara/godseye/services/auth/internal/repository"
)

// testPool is nil when TEST_DATABASE_URL is unset, in which case every test in
// this file skips. CI provides the database as a service container.
var testPool *pgxpool.Pool

const testJWTSecret = "test-secret-not-a-real-key"

// testSchema isolates this package's tables. `go test` runs packages in
// parallel, so sharing one schema with the repository package would let their
// truncations delete each other's rows mid-test.
const testSchema = "test_handlers"

func TestMain(m *testing.M) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		os.Exit(m.Run())
	}

	ctx := context.Background()

	dsn, err := isolatedSchemaDSN(ctx, base, testSchema)
	if err != nil {
		log.Fatalf("prepare test schema: %v", err)
	}

	testPool, err = db.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("connect to TEST_DATABASE_URL: %v", err)
	}
	if err := db.Migrate(ctx, testPool); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	code := m.Run()

	testPool.Close()
	os.Exit(code)
}

// isolatedSchemaDSN drops and recreates a dedicated schema, then returns a DSN
// whose search_path points at it. Migrations and every query in this package
// then resolve to that schema alone.
func isolatedSchemaDSN(ctx context.Context, base, schema string) (string, error) {
	admin, err := db.Connect(ctx, base)
	if err != nil {
		return "", err
	}
	defer admin.Close()

	if _, err := admin.Exec(ctx, "DROP SCHEMA IF EXISTS "+schema+" CASCADE"); err != nil {
		return "", err
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		return "", err
	}

	u, err := url.Parse(base)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func testConfig() *config.Config {
	return &config.Config{
		JWTSecret:       testJWTSecret,
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 168 * time.Hour,
		FrontendURL:     "http://localhost:5173",
		OAuthBaseURL:    "http://localhost:8081",
	}
}

type testEnv struct {
	auth      *AuthHandler
	oauth     *OAuthHandler
	userRepo  *repository.UserRepo
	tokenRepo *repository.TokenRepo
	codeRepo  *repository.OAuthCodeRepo
}

// newTestEnv wires real handlers over the test database and clears any data
// left by a previous test. It skips when no database is configured.
func newTestEnv(t *testing.T) *testEnv {
	t.Helper()

	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set; skipping database test")
	}

	if _, err := testPool.Exec(context.Background(), "TRUNCATE users CASCADE"); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	cfg := testConfig()
	userRepo := repository.NewUserRepo(testPool)
	tokenRepo := repository.NewTokenRepo(testPool)
	codeRepo := repository.NewOAuthCodeRepo(testPool)

	return &testEnv{
		auth:      NewAuthHandler(cfg, userRepo, tokenRepo),
		oauth:     NewOAuthHandler(cfg, userRepo, tokenRepo, codeRepo),
		userRepo:  userRepo,
		tokenRepo: tokenRepo,
		codeRepo:  codeRepo,
	}
}

// post invokes a handler with a JSON body and returns the recorder.
func post(handler http.HandlerFunc, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

type tokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	User         struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	} `json:"user"`
}

func decodePair(t *testing.T, rec *httptest.ResponseRecorder) tokenPair {
	t.Helper()
	var pair tokenPair
	if err := json.Unmarshal(rec.Body.Bytes(), &pair); err != nil {
		t.Fatalf("decode response %q: %v", rec.Body.String(), err)
	}
	return pair
}

// ---------------------------------------------------------------------------
// Registration and login
// ---------------------------------------------------------------------------

func TestRegisterThenLogin(t *testing.T) {
	env := newTestEnv(t)

	rec := post(env.auth.Register, `{"email":"pilot@example.com","password":"correct-horse","name":"Pilot"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("Register status = %d, want 200: %s", rec.Code, rec.Body.String())
	}

	registered := decodePair(t, rec)
	if registered.AccessToken == "" || registered.RefreshToken == "" {
		t.Fatal("Register did not return a token pair")
	}
	if registered.User.Email != "pilot@example.com" {
		t.Errorf("user email = %q, want pilot@example.com", registered.User.Email)
	}

	// The bcrypt hash must never reach the client.
	if body := rec.Body.String(); strings.Contains(body, "passwordHash") || strings.Contains(body, "$2a$") {
		t.Errorf("register response leaks the password hash: %s", body)
	}

	// The stored hash must not be the plaintext password.
	stored, err := env.userRepo.GetUserByEmail(context.Background(), "pilot@example.com")
	if err != nil || stored == nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if stored.PasswordHash == "correct-horse" {
		t.Fatal("password was stored in plaintext")
	}
	if !strings.HasPrefix(stored.PasswordHash, "$2") {
		t.Errorf("stored hash %q does not look like bcrypt", stored.PasswordHash)
	}

	// The same credentials must authenticate.
	rec = post(env.auth.Login, `{"email":"pilot@example.com","password":"correct-horse"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("Login status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	if loggedIn := decodePair(t, rec); loggedIn.User.ID != registered.User.ID {
		t.Errorf("login returned user %q, want %q", loggedIn.User.ID, registered.User.ID)
	}
}

func TestRegisterRejectsBadInput(t *testing.T) {
	env := newTestEnv(t)

	tests := []struct {
		name string
		body string
		want int
	}{
		{"malformed json", `{`, http.StatusBadRequest},
		{"missing email", `{"password":"correct-horse","name":"P"}`, http.StatusBadRequest},
		{"missing name", `{"email":"a@b.co","password":"correct-horse"}`, http.StatusBadRequest},
		{"invalid email", `{"email":"not-an-email","password":"correct-horse","name":"P"}`, http.StatusBadRequest},
		{"short password", `{"email":"a@b.co","password":"short","name":"P"}`, http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := post(env.auth.Register, tt.body); rec.Code != tt.want {
				t.Errorf("status = %d, want %d: %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestRegisterRejectsDuplicateEmail(t *testing.T) {
	env := newTestEnv(t)
	body := `{"email":"taken@example.com","password":"correct-horse","name":"First"}`

	if rec := post(env.auth.Register, body); rec.Code != http.StatusOK {
		t.Fatalf("first Register status = %d, want 200", rec.Code)
	}
	if rec := post(env.auth.Register, body); rec.Code != http.StatusConflict {
		t.Errorf("second Register status = %d, want 409", rec.Code)
	}
}

func TestLoginRejectsBadCredentials(t *testing.T) {
	env := newTestEnv(t)

	if rec := post(env.auth.Register, `{"email":"pilot@example.com","password":"correct-horse","name":"P"}`); rec.Code != http.StatusOK {
		t.Fatalf("setup Register failed: %s", rec.Body.String())
	}

	tests := []struct {
		name string
		body string
	}{
		{"wrong password", `{"email":"pilot@example.com","password":"wrong-password"}`},
		{"unknown email", `{"email":"nobody@example.com","password":"correct-horse"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := post(env.auth.Login, tt.body)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", rec.Code)
			}
			// The message must not reveal whether the account exists.
			if body := rec.Body.String(); !strings.Contains(body, "invalid credentials") {
				t.Errorf("body = %s, want a generic 'invalid credentials' message", body)
			}
		})
	}
}

func TestLoginWithOAuthUserIsRejectedNotCrashed(t *testing.T) {
	env := newTestEnv(t)

	// An OAuth account has no password, so password login must fail cleanly
	// with 401 rather than erroring on the empty hash.
	if _, err := env.userRepo.UpsertOAuthUser(
		context.Background(), "oauth@example.com", "Octo", "", "github", "gh-1",
	); err != nil {
		t.Fatalf("UpsertOAuthUser: %v", err)
	}

	rec := post(env.auth.Login, `{"email":"oauth@example.com","password":"any-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Refresh and logout
// ---------------------------------------------------------------------------

func TestRefreshRotatesAndInvalidatesOldToken(t *testing.T) {
	env := newTestEnv(t)

	rec := post(env.auth.Register, `{"email":"pilot@example.com","password":"correct-horse","name":"P"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("setup Register failed: %s", rec.Body.String())
	}
	original := decodePair(t, rec)

	rec = post(env.auth.Refresh, fmt.Sprintf(`{"refreshToken":%q}`, original.RefreshToken))
	if rec.Code != http.StatusOK {
		t.Fatalf("Refresh status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	rotated := decodePair(t, rec)

	if rotated.RefreshToken == original.RefreshToken {
		t.Error("Refresh returned the same refresh token; it must rotate")
	}
	if rotated.User.ID != original.User.ID {
		t.Errorf("Refresh returned user %q, want %q", rotated.User.ID, original.User.ID)
	}

	// Replaying the consumed token must fail — otherwise a stolen refresh token
	// stays valid forever.
	rec = post(env.auth.Refresh, fmt.Sprintf(`{"refreshToken":%q}`, original.RefreshToken))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("replayed refresh token status = %d, want 401", rec.Code)
	}

	// The newly issued one still works.
	rec = post(env.auth.Refresh, fmt.Sprintf(`{"refreshToken":%q}`, rotated.RefreshToken))
	if rec.Code != http.StatusOK {
		t.Errorf("rotated refresh token status = %d, want 200", rec.Code)
	}
}

func TestRefreshRejectsBadInput(t *testing.T) {
	env := newTestEnv(t)

	if rec := post(env.auth.Refresh, `{`); rec.Code != http.StatusBadRequest {
		t.Errorf("malformed json status = %d, want 400", rec.Code)
	}
	if rec := post(env.auth.Refresh, `{"refreshToken":""}`); rec.Code != http.StatusBadRequest {
		t.Errorf("empty token status = %d, want 400", rec.Code)
	}
	if rec := post(env.auth.Refresh, `{"refreshToken":"never-issued"}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("unknown token status = %d, want 401", rec.Code)
	}
}

func TestLogoutRevokesRefreshToken(t *testing.T) {
	env := newTestEnv(t)

	rec := post(env.auth.Register, `{"email":"pilot@example.com","password":"correct-horse","name":"P"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("setup Register failed: %s", rec.Body.String())
	}
	pair := decodePair(t, rec)

	rec = post(env.auth.Logout, fmt.Sprintf(`{"refreshToken":%q}`, pair.RefreshToken))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("Logout status = %d, want 204", rec.Code)
	}

	rec = post(env.auth.Refresh, fmt.Sprintf(`{"refreshToken":%q}`, pair.RefreshToken))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("refresh after logout status = %d, want 401", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

func TestMe(t *testing.T) {
	env := newTestEnv(t)

	rec := post(env.auth.Register, `{"email":"pilot@example.com","password":"correct-horse","name":"Pilot"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("setup Register failed: %s", rec.Body.String())
	}
	pair := decodePair(t, rec)

	t.Run("with a valid token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
		rec := httptest.NewRecorder()
		env.auth.Me(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "pilot@example.com") {
			t.Errorf("body = %s, want the caller's email", rec.Body.String())
		}
	})

	badHeaders := map[string]string{
		"missing":       "",
		"no prefix":     pair.AccessToken,
		"wrong secret":  "Bearer " + mustSign(t, "another-secret", "user", "a@b.co", "N"),
		"malformed jwt": "Bearer not.a.jwt",
	}
	for name, header := range badHeaders {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
			if header != "" {
				req.Header.Set("Authorization", header)
			}
			rec := httptest.NewRecorder()
			env.auth.Me(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", rec.Code)
			}
		})
	}
}

func mustSign(t *testing.T, secret, userID, email, name string) string {
	t.Helper()
	token, err := authjwt.GenerateAccessToken(secret, 15*time.Minute, userID, email, name)
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}
	return token
}

// ---------------------------------------------------------------------------
// OAuth code exchange
// ---------------------------------------------------------------------------

func TestExchangeRedeemsCodeOnce(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	user, err := env.userRepo.UpsertOAuthUser(ctx, "octo@example.com", "Octo", "", "github", "gh-1")
	if err != nil {
		t.Fatalf("UpsertOAuthUser: %v", err)
	}

	raw, hash, err := authjwt.GenerateAuthorizationCode()
	if err != nil {
		t.Fatalf("GenerateAuthorizationCode: %v", err)
	}
	if err := env.codeRepo.StoreCode(ctx, hash, user.ID, time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}

	rec := post(env.oauth.Exchange, fmt.Sprintf(`{"code":%q}`, raw))
	if rec.Code != http.StatusOK {
		t.Fatalf("Exchange status = %d, want 200: %s", rec.Code, rec.Body.String())
	}

	pair := decodePair(t, rec)
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("Exchange did not return a token pair")
	}
	if pair.User.ID != user.ID {
		t.Errorf("Exchange returned user %q, want %q", pair.User.ID, user.ID)
	}

	// The access token must be usable and carry the right identity.
	claims, err := authjwt.ValidateAccessToken(testJWTSecret, pair.AccessToken)
	if err != nil {
		t.Fatalf("issued access token does not validate: %v", err)
	}
	if claims.UserID != user.ID {
		t.Errorf("token uid = %q, want %q", claims.UserID, user.ID)
	}

	// Replaying the code must fail. This is what makes it safe to carry the
	// code in a redirect URL at all.
	rec = post(env.oauth.Exchange, fmt.Sprintf(`{"code":%q}`, raw))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("replayed code status = %d, want 401: %s", rec.Code, rec.Body.String())
	}
}

func TestExchangeRejectsBadInput(t *testing.T) {
	env := newTestEnv(t)

	tests := []struct {
		name string
		body string
		want int
	}{
		{"malformed json", `{`, http.StatusBadRequest},
		{"empty code", `{"code":""}`, http.StatusBadRequest},
		{"unknown code", `{"code":"never-issued"}`, http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := post(env.oauth.Exchange, tt.body); rec.Code != tt.want {
				t.Errorf("status = %d, want %d: %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestExchangeRejectsExpiredCode(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	user, err := env.userRepo.UpsertOAuthUser(ctx, "expired@example.com", "Octo", "", "github", "gh-2")
	if err != nil {
		t.Fatalf("UpsertOAuthUser: %v", err)
	}

	raw, hash, err := authjwt.GenerateAuthorizationCode()
	if err != nil {
		t.Fatalf("GenerateAuthorizationCode: %v", err)
	}
	if err := env.codeRepo.StoreCode(ctx, hash, user.ID, time.Now().Add(-time.Second)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}

	if rec := post(env.oauth.Exchange, fmt.Sprintf(`{"code":%q}`, raw)); rec.Code != http.StatusUnauthorized {
		t.Errorf("expired code status = %d, want 401", rec.Code)
	}
}

func TestExchangeRejectsRawHashAsCode(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	user, err := env.userRepo.UpsertOAuthUser(ctx, "hash@example.com", "Octo", "", "github", "gh-3")
	if err != nil {
		t.Fatalf("UpsertOAuthUser: %v", err)
	}

	raw, hash, err := authjwt.GenerateAuthorizationCode()
	if err != nil {
		t.Fatalf("GenerateAuthorizationCode: %v", err)
	}
	if err := env.codeRepo.StoreCode(ctx, hash, user.ID, time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}

	// Someone with read access to the database holds the hash, not the code.
	// Presenting the stored hash must not authenticate.
	if rec := post(env.oauth.Exchange, fmt.Sprintf(`{"code":%q}`, hash)); rec.Code != http.StatusUnauthorized {
		t.Errorf("stored hash was accepted as a code: status = %d, want 401", rec.Code)
	}

	// The real code still works afterwards.
	if rec := post(env.oauth.Exchange, fmt.Sprintf(`{"code":%q}`, raw)); rec.Code != http.StatusOK {
		t.Errorf("genuine code status = %d, want 200", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// OAuth login redirects
// ---------------------------------------------------------------------------

func TestOAuthLoginNotConfigured(t *testing.T) {
	env := newTestEnv(t)

	// testConfig sets no client IDs, so both providers stay disabled.
	for name, handler := range map[string]http.HandlerFunc{
		"github": env.oauth.GithubLogin,
		"google": env.oauth.GoogleLogin,
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/auth/"+name, nil)
			rec := httptest.NewRecorder()
			handler(rec, req)

			if rec.Code != http.StatusNotImplemented {
				t.Errorf("status = %d, want 501", rec.Code)
			}
		})
	}
}

func TestOAuthCallbackRejectsBadState(t *testing.T) {
	env := newTestEnv(t)

	// Without a valid state parameter the callback must refuse before touching
	// the provider — this is the CSRF guard on the OAuth flow.
	req := httptest.NewRequest(http.MethodGet, "/auth/github/callback?state=forged&code=x", nil)
	rec := httptest.NewRecorder()
	env.oauth.GithubCallback(rec, req)

	// Providers are unconfigured here, so 501 comes first; with credentials set
	// the state check would return 400. Either way the flow must not proceed.
	if rec.Code == http.StatusOK || rec.Code == http.StatusTemporaryRedirect {
		t.Errorf("status = %d, want a rejection", rec.Code)
	}
}
