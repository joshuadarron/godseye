package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OAuthCodeRepo provides operations on the oauth_codes table.
type OAuthCodeRepo struct {
	pool *pgxpool.Pool
}

// NewOAuthCodeRepo creates a new OAuthCodeRepo.
func NewOAuthCodeRepo(pool *pgxpool.Pool) *OAuthCodeRepo {
	return &OAuthCodeRepo{pool: pool}
}

// StoreCode records an authorization code hash for a user.
func (r *OAuthCodeRepo) StoreCode(ctx context.Context, codeHash, userID string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO oauth_codes (code_hash, user_id, expires_at)
		VALUES ($1, $2, $3)
	`, codeHash, userID, expiresAt)
	if err != nil {
		return fmt.Errorf("store oauth code: %w", err)
	}
	return nil
}

// ConsumeCode redeems an authorization code and returns the user it belongs to.
// The DELETE ... RETURNING is a single statement, so a code can only ever be
// redeemed once even if two requests race. Returns ("", nil) when the code is
// unknown, already used, or expired.
func (r *OAuthCodeRepo) ConsumeCode(ctx context.Context, codeHash string) (string, error) {
	var userID string
	err := r.pool.QueryRow(ctx, `
		DELETE FROM oauth_codes
		WHERE code_hash = $1 AND expires_at > NOW()
		RETURNING user_id
	`, codeHash).Scan(&userID)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("consume oauth code: %w", err)
	}
	return userID, nil
}

// DeleteExpiredCodes purges codes that were never redeemed.
func (r *OAuthCodeRepo) DeleteExpiredCodes(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM oauth_codes WHERE expires_at <= NOW()`)
	if err != nil {
		return fmt.Errorf("delete expired oauth codes: %w", err)
	}
	return nil
}
