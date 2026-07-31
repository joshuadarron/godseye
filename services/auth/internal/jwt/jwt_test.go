package jwt

import (
	"encoding/hex"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-not-a-real-key"

func TestAccessTokenRoundTrip(t *testing.T) {
	token, err := GenerateAccessToken(testSecret, 15*time.Minute, "user-123", "pilot@example.com", "Test Pilot")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	claims, err := ValidateAccessToken(testSecret, token)
	if err != nil {
		t.Fatalf("ValidateAccessToken: %v", err)
	}

	if claims.UserID != "user-123" {
		t.Errorf("UserID = %q, want %q", claims.UserID, "user-123")
	}
	if claims.Email != "pilot@example.com" {
		t.Errorf("Email = %q, want %q", claims.Email, "pilot@example.com")
	}
	if claims.Name != "Test Pilot" {
		t.Errorf("Name = %q, want %q", claims.Name, "Test Pilot")
	}
	if claims.Issuer != "godseye-auth" {
		t.Errorf("Issuer = %q, want %q", claims.Issuer, "godseye-auth")
	}
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		t.Fatal("expected both exp and iat to be set")
	}
	if got := claims.ExpiresAt.Sub(claims.IssuedAt.Time); got != 15*time.Minute {
		t.Errorf("token lifetime = %v, want %v", got, 15*time.Minute)
	}
}

func TestValidateAccessTokenRejectsWrongSecret(t *testing.T) {
	token, err := GenerateAccessToken(testSecret, 15*time.Minute, "user-123", "a@b.co", "A")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	if _, err := ValidateAccessToken("a-completely-different-secret", token); err == nil {
		t.Fatal("expected validation to fail against a different secret")
	}
}

func TestValidateAccessTokenRejectsExpired(t *testing.T) {
	// A negative TTL produces a token that expired before it was issued.
	token, err := GenerateAccessToken(testSecret, -1*time.Minute, "user-123", "a@b.co", "A")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	if _, err := ValidateAccessToken(testSecret, token); err == nil {
		t.Fatal("expected validation to fail for an expired token")
	}
}

func TestValidateAccessTokenRejectsAlgNone(t *testing.T) {
	// Algorithm confusion: an attacker strips the signature and sets alg to
	// "none". The keyfunc must refuse anything that is not HMAC.
	unsigned := jwt.NewWithClaims(jwt.SigningMethodNone, UserClaims{
		UserID: "attacker",
		Email:  "attacker@example.com",
		Name:   "Attacker",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			Issuer:    "godseye-auth",
		},
	})
	token, err := unsigned.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none-alg token: %v", err)
	}

	if _, err := ValidateAccessToken(testSecret, token); err == nil {
		t.Fatal("expected validation to reject an alg=none token")
	}
}

func TestValidateAccessTokenRejectsGarbage(t *testing.T) {
	for _, token := range []string{"", "not.a.jwt", "a.b", strings.Repeat("x", 100)} {
		if _, err := ValidateAccessToken(testSecret, token); err == nil {
			t.Errorf("expected validation to fail for %q", token)
		}
	}
}

func TestGenerateOpaqueToken(t *testing.T) {
	raw, hash, err := GenerateOpaqueToken()
	if err != nil {
		t.Fatalf("GenerateOpaqueToken: %v", err)
	}

	// 32 random bytes hex-encoded, and a SHA-256 hash likewise.
	if len(raw) != 64 {
		t.Errorf("raw length = %d, want 64 hex chars", len(raw))
	}
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64 hex chars", len(hash))
	}
	if _, err := hex.DecodeString(raw); err != nil {
		t.Errorf("raw token is not valid hex: %v", err)
	}
	if raw == hash {
		t.Error("raw token and its hash must differ — the raw value must never be what is stored")
	}
	if got := HashToken(raw); got != hash {
		t.Errorf("HashToken(raw) = %q, want %q", got, hash)
	}
}

func TestOpaqueTokensAreUnique(t *testing.T) {
	// Collisions here would let one user's authorization code or refresh token
	// redeem another's session.
	seen := make(map[string]bool, 1000)
	for i := 0; i < 1000; i++ {
		raw, _, err := GenerateOpaqueToken()
		if err != nil {
			t.Fatalf("GenerateOpaqueToken: %v", err)
		}
		if seen[raw] {
			t.Fatalf("duplicate token generated: %q", raw)
		}
		seen[raw] = true
	}
}

func TestRefreshTokenAndAuthorizationCodeAreOpaqueTokens(t *testing.T) {
	// Both delegate to GenerateOpaqueToken; assert the contract each caller
	// relies on rather than the delegation itself.
	for name, gen := range map[string]func() (string, string, error){
		"GenerateRefreshToken":      GenerateRefreshToken,
		"GenerateAuthorizationCode": GenerateAuthorizationCode,
	} {
		raw, hash, err := gen()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if len(raw) != 64 || len(hash) != 64 {
			t.Errorf("%s: raw/hash lengths = %d/%d, want 64/64", name, len(raw), len(hash))
		}
		if HashToken(raw) != hash {
			t.Errorf("%s: returned hash does not match HashToken(raw)", name)
		}
	}
}

func TestHashTokenIsDeterministic(t *testing.T) {
	const raw = "deadbeef"

	first := HashToken(raw)
	if second := HashToken(raw); first != second {
		t.Errorf("HashToken is not deterministic: %q then %q", first, second)
	}
	if other := HashToken("deadbeee"); other == first {
		t.Error("distinct inputs produced the same hash")
	}
}

func TestStateTokenRoundTrip(t *testing.T) {
	state, err := GenerateStateToken(testSecret)
	if err != nil {
		t.Fatalf("GenerateStateToken: %v", err)
	}

	if err := ValidateStateToken(testSecret, state); err != nil {
		t.Errorf("ValidateStateToken: %v", err)
	}
}

func TestStateTokenRejectsTampering(t *testing.T) {
	state, err := GenerateStateToken(testSecret)
	if err != nil {
		t.Fatalf("GenerateStateToken: %v", err)
	}

	if err := ValidateStateToken("a-different-secret", state); err == nil {
		t.Error("expected a state token signed with another secret to be rejected")
	}
	if err := ValidateStateToken(testSecret, ""); err == nil {
		t.Error("expected an empty state token to be rejected")
	}
	if err := ValidateStateToken(testSecret, "not.a.jwt"); err == nil {
		t.Error("expected a malformed state token to be rejected")
	}
}

func TestStateTokensAreUnique(t *testing.T) {
	// Each login attempt must get a distinct nonce, otherwise the state
	// parameter provides no CSRF protection.
	first, err := GenerateStateToken(testSecret)
	if err != nil {
		t.Fatalf("GenerateStateToken: %v", err)
	}
	second, err := GenerateStateToken(testSecret)
	if err != nil {
		t.Fatalf("GenerateStateToken: %v", err)
	}
	if first == second {
		t.Error("two state tokens were identical")
	}
}

func TestStateTokenExpires(t *testing.T) {
	// The 5-minute TTL is hard-coded, so hand-build an already-expired token
	// with the same shape to prove expiry is enforced.
	expired := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		ID:        "nonce",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Minute)),
		Issuer:    "godseye-auth",
	})
	token, err := expired.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign expired state token: %v", err)
	}

	if err := ValidateStateToken(testSecret, token); err == nil {
		t.Error("expected an expired state token to be rejected")
	}
}
