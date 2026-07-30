package repository

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/joshuaferrara/godseye/services/auth/internal/db"
)

// testPool is nil when TEST_DATABASE_URL is unset, in which case every test in
// this file skips. CI provides the database as a service container; locally,
// `docker compose up -d` plus the env var is enough.
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		// No database configured — tests skip rather than fail, so `go test ./...`
		// still works on a machine without Docker.
		os.Exit(m.Run())
	}

	ctx := context.Background()

	var err error
	testPool, err = db.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("connect to TEST_DATABASE_URL: %v", err)
	}

	// Build the schema with the same migrations the service runs at startup,
	// so the tests cannot drift from production DDL.
	if err := db.Migrate(ctx, testPool); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	code := m.Run()

	testPool.Close()
	os.Exit(code)
}

// truncate skips the test when no database is configured, and otherwise clears
// all data. refresh_tokens and oauth_codes cascade from users.
func truncate(t *testing.T) {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL not set; skipping database test")
	}
	if _, err := testPool.Exec(context.Background(), "TRUNCATE users CASCADE"); err != nil {
		t.Fatalf("truncate: %v", err)
	}
}

// createTestUser inserts a local user and returns it.
func createTestUser(t *testing.T, email string) *User {
	t.Helper()
	user, err := NewUserRepo(testPool).CreateUser(
		context.Background(), email, "not-a-real-hash", "Test User", "local", "",
	)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	return user
}

// ---------------------------------------------------------------------------
// OAuth authorization codes
// ---------------------------------------------------------------------------

func TestConsumeCodeIsSingleUse(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "single-use@example.com")
	repo := NewOAuthCodeRepo(testPool)

	if err := repo.StoreCode(ctx, "code-hash-1", user.ID, time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}

	// First redemption hands back the owning user.
	got, err := repo.ConsumeCode(ctx, "code-hash-1")
	if err != nil {
		t.Fatalf("first ConsumeCode: %v", err)
	}
	if got != user.ID {
		t.Fatalf("first ConsumeCode returned %q, want %q", got, user.ID)
	}

	// The second must find nothing. This is the guarantee the OAuth redirect
	// rests on: a code leaked from browser history or a proxy log is already
	// spent by the time an attacker sees it.
	got, err = repo.ConsumeCode(ctx, "code-hash-1")
	if err != nil {
		t.Fatalf("second ConsumeCode: %v", err)
	}
	if got != "" {
		t.Errorf("second ConsumeCode returned %q, want empty — the code was reusable", got)
	}
}

func TestConsumeCodeRejectsExpired(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "expired@example.com")
	repo := NewOAuthCodeRepo(testPool)

	if err := repo.StoreCode(ctx, "stale-hash", user.ID, time.Now().Add(-time.Second)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}

	got, err := repo.ConsumeCode(ctx, "stale-hash")
	if err != nil {
		t.Fatalf("ConsumeCode: %v", err)
	}
	if got != "" {
		t.Errorf("ConsumeCode returned %q for an expired code, want empty", got)
	}
}

func TestConsumeCodeUnknownHash(t *testing.T) {
	truncate(t)

	got, err := NewOAuthCodeRepo(testPool).ConsumeCode(context.Background(), "never-issued")
	if err != nil {
		t.Fatalf("ConsumeCode: %v", err)
	}
	if got != "" {
		t.Errorf("ConsumeCode returned %q for an unknown hash, want empty", got)
	}
}

func TestDeleteExpiredCodesLeavesLiveOnes(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "purge@example.com")
	repo := NewOAuthCodeRepo(testPool)

	if err := repo.StoreCode(ctx, "live", user.ID, time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("StoreCode(live): %v", err)
	}
	if err := repo.StoreCode(ctx, "dead", user.ID, time.Now().Add(-time.Minute)); err != nil {
		t.Fatalf("StoreCode(dead): %v", err)
	}

	if err := repo.DeleteExpiredCodes(ctx); err != nil {
		t.Fatalf("DeleteExpiredCodes: %v", err)
	}

	if got, _ := repo.ConsumeCode(ctx, "live"); got != user.ID {
		t.Errorf("live code was purged; ConsumeCode returned %q", got)
	}
	var remaining int
	if err := testPool.QueryRow(ctx, "SELECT count(*) FROM oauth_codes").Scan(&remaining); err != nil {
		t.Fatalf("count codes: %v", err)
	}
	if remaining != 0 {
		t.Errorf("%d codes left after purge and redemption, want 0", remaining)
	}
}

func TestCodesCascadeOnUserDelete(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "cascade@example.com")
	repo := NewOAuthCodeRepo(testPool)

	if err := repo.StoreCode(ctx, "orphan-me", user.ID, time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("StoreCode: %v", err)
	}
	if _, err := testPool.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	got, err := repo.ConsumeCode(ctx, "orphan-me")
	if err != nil {
		t.Fatalf("ConsumeCode: %v", err)
	}
	if got != "" {
		t.Errorf("code outlived its user, returned %q", got)
	}
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

func TestRefreshTokenLifecycle(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "refresh@example.com")
	repo := NewTokenRepo(testPool)

	if err := repo.StoreRefreshToken(ctx, user.ID, "hash-a", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("StoreRefreshToken: %v", err)
	}

	stored, err := repo.GetRefreshToken(ctx, "hash-a")
	if err != nil {
		t.Fatalf("GetRefreshToken: %v", err)
	}
	if stored == nil {
		t.Fatal("GetRefreshToken returned nil for a live token")
	}
	if stored.UserID != user.ID {
		t.Errorf("UserID = %q, want %q", stored.UserID, user.ID)
	}

	// Rotation: once deleted the old token must never validate again.
	if err := repo.DeleteRefreshToken(ctx, "hash-a"); err != nil {
		t.Fatalf("DeleteRefreshToken: %v", err)
	}
	stored, err = repo.GetRefreshToken(ctx, "hash-a")
	if err != nil {
		t.Fatalf("GetRefreshToken after delete: %v", err)
	}
	if stored != nil {
		t.Error("a rotated refresh token still validates")
	}
}

func TestGetRefreshTokenRejectsExpired(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "expired-refresh@example.com")
	repo := NewTokenRepo(testPool)

	if err := repo.StoreRefreshToken(ctx, user.ID, "hash-old", time.Now().Add(-time.Hour)); err != nil {
		t.Fatalf("StoreRefreshToken: %v", err)
	}

	stored, err := repo.GetRefreshToken(ctx, "hash-old")
	if err != nil {
		t.Fatalf("GetRefreshToken: %v", err)
	}
	if stored != nil {
		t.Error("an expired refresh token still validates")
	}
}

func TestDeleteAllUserRefreshTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "logout-everywhere@example.com")
	other := createTestUser(t, "bystander@example.com")
	repo := NewTokenRepo(testPool)

	for _, hash := range []string{"session-1", "session-2", "session-3"} {
		if err := repo.StoreRefreshToken(ctx, user.ID, hash, time.Now().Add(time.Hour)); err != nil {
			t.Fatalf("StoreRefreshToken(%s): %v", hash, err)
		}
	}
	if err := repo.StoreRefreshToken(ctx, other.ID, "other-session", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("StoreRefreshToken(other): %v", err)
	}

	if err := repo.DeleteAllUserRefreshTokens(ctx, user.ID); err != nil {
		t.Fatalf("DeleteAllUserRefreshTokens: %v", err)
	}

	for _, hash := range []string{"session-1", "session-2", "session-3"} {
		if stored, _ := repo.GetRefreshToken(ctx, hash); stored != nil {
			t.Errorf("%s survived a full logout", hash)
		}
	}
	// Another user's sessions must be untouched.
	if stored, _ := repo.GetRefreshToken(ctx, "other-session"); stored == nil {
		t.Error("another user's session was revoked")
	}
}

func TestRefreshTokenHashIsUnique(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	user := createTestUser(t, "dupe@example.com")
	repo := NewTokenRepo(testPool)

	if err := repo.StoreRefreshToken(ctx, user.ID, "same-hash", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("first StoreRefreshToken: %v", err)
	}
	if err := repo.StoreRefreshToken(ctx, user.ID, "same-hash", time.Now().Add(time.Hour)); err == nil {
		t.Error("storing a duplicate token hash succeeded; the UNIQUE constraint is missing")
	}
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

func TestCreateAndFetchUser(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	repo := NewUserRepo(testPool)

	created, err := repo.CreateUser(ctx, "local@example.com", "hashed-pw", "Local User", "local", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if created.ID == "" {
		t.Fatal("CreateUser returned an empty id")
	}

	byEmail, err := repo.GetUserByEmail(ctx, "local@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if byEmail == nil || byEmail.ID != created.ID {
		t.Fatalf("GetUserByEmail returned %+v, want the created user", byEmail)
	}
	if byEmail.PasswordHash != "hashed-pw" {
		t.Errorf("PasswordHash = %q, want %q", byEmail.PasswordHash, "hashed-pw")
	}

	byID, err := repo.GetUserByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if byID == nil || byID.Email != "local@example.com" {
		t.Fatalf("GetUserByID returned %+v, want the created user", byID)
	}
}

func TestGetUserMissingReturnsNilNotError(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	repo := NewUserRepo(testPool)

	// Handlers branch on a nil user, so a miss must not surface as an error.
	user, err := repo.GetUserByEmail(ctx, "nobody@example.com")
	if err != nil {
		t.Errorf("GetUserByEmail: unexpected error %v", err)
	}
	if user != nil {
		t.Errorf("GetUserByEmail returned %+v, want nil", user)
	}

	user, err = repo.GetUserByProviderID(ctx, "github", "does-not-exist")
	if err != nil {
		t.Errorf("GetUserByProviderID: unexpected error %v", err)
	}
	if user != nil {
		t.Errorf("GetUserByProviderID returned %+v, want nil", user)
	}
}

func TestCreateUserRejectsDuplicateEmail(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	repo := NewUserRepo(testPool)

	if _, err := repo.CreateUser(ctx, "dupe@example.com", "pw", "First", "local", ""); err != nil {
		t.Fatalf("first CreateUser: %v", err)
	}
	if _, err := repo.CreateUser(ctx, "dupe@example.com", "pw", "Second", "local", ""); err == nil {
		t.Error("duplicate email was accepted; the UNIQUE constraint is missing")
	}
}

func TestUpsertOAuthUserCreatesThenUpdates(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	repo := NewUserRepo(testPool)

	// OAuth users never set a password, so password_hash is NULL in the
	// database and must come back as an empty string rather than failing the
	// scan.
	created, err := repo.UpsertOAuthUser(ctx, "oauth@example.com", "Octo Cat", "https://avatars/1", "github", "gh-1")
	if err != nil {
		t.Fatalf("UpsertOAuthUser (create): %v", err)
	}
	if created.PasswordHash != "" {
		t.Errorf("PasswordHash = %q, want empty for an OAuth user", created.PasswordHash)
	}
	if created.Provider != "github" || created.ProviderID != "gh-1" {
		t.Errorf("provider = %q/%q, want github/gh-1", created.Provider, created.ProviderID)
	}

	// Signing in again updates the profile in place rather than creating a
	// second account.
	updated, err := repo.UpsertOAuthUser(ctx, "oauth@example.com", "Octo Cat Renamed", "https://avatars/2", "github", "gh-1")
	if err != nil {
		t.Fatalf("UpsertOAuthUser (update): %v", err)
	}
	if updated.ID != created.ID {
		t.Errorf("id changed on re-login: %q then %q", created.ID, updated.ID)
	}
	if updated.Name != "Octo Cat Renamed" {
		t.Errorf("Name = %q, want the updated value", updated.Name)
	}
	if updated.AvatarURL != "https://avatars/2" {
		t.Errorf("AvatarURL = %q, want the updated value", updated.AvatarURL)
	}

	var count int
	if err := testPool.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&count); err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 1 {
		t.Errorf("%d user rows after two logins, want 1", count)
	}
}

func TestOAuthUserIsFetchableAfterUpsert(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	repo := NewUserRepo(testPool)

	created, err := repo.UpsertOAuthUser(ctx, "fetchme@example.com", "Name", "", "google", "goog-1")
	if err != nil {
		t.Fatalf("UpsertOAuthUser: %v", err)
	}

	// Every read path has to survive the NULL password_hash, not just the
	// upsert's own RETURNING clause.
	for name, fetch := range map[string]func() (*User, error){
		"GetUserByID":         func() (*User, error) { return repo.GetUserByID(ctx, created.ID) },
		"GetUserByEmail":      func() (*User, error) { return repo.GetUserByEmail(ctx, "fetchme@example.com") },
		"GetUserByProviderID": func() (*User, error) { return repo.GetUserByProviderID(ctx, "google", "goog-1") },
	} {
		user, err := fetch()
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		if user == nil {
			t.Errorf("%s returned nil for an existing OAuth user", name)
			continue
		}
		if user.PasswordHash != "" {
			t.Errorf("%s: PasswordHash = %q, want empty", name, user.PasswordHash)
		}
	}
}

func TestUserJSONNeverLeaksSecrets(t *testing.T) {
	// The full User struct is embedded in the auth response, so a future edit
	// dropping these json:"-" tags would ship the bcrypt hash to the browser.
	data, err := json.Marshal(&User{
		ID:           "id",
		Email:        "a@b.co",
		PasswordHash: "$2a$12$averysecretbcrypthash",
		Name:         "Name",
		ProviderID:   "provider-secret",
	})
	if err != nil {
		t.Fatalf("marshal user: %v", err)
	}

	body := string(data)
	for _, secret := range []string{"passwordHash", "password_hash", "averysecretbcrypthash", "provider-secret"} {
		if strings.Contains(body, secret) {
			t.Errorf("serialised user leaks %q: %s", secret, body)
		}
	}
	if !strings.Contains(body, "a@b.co") {
		t.Errorf("serialised user is missing the email: %s", body)
	}
}
