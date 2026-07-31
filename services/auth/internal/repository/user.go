package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User represents a row in the users table.
//
// PasswordHash is empty for OAuth users: they never set a password, so the
// column is NULL in the database. Every query COALESCEs it to an empty string
// so the NULL never reaches this plain string field.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	AvatarURL    string    `json:"avatarUrl"`
	Provider     string    `json:"provider"`
	ProviderID   string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// UserRepo provides CRUD operations on the users table.
type UserRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo creates a new UserRepo.
func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

// CreateUser inserts a new user and returns it.
func (r *UserRepo) CreateUser(ctx context.Context, email, passwordHash, name, provider, providerID string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, name, provider, provider_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, email, COALESCE(password_hash, ''), name, avatar_url, provider, provider_id, created_at, updated_at
	`, email, passwordHash, name, provider, providerID).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// GetUserByEmail returns a user by email, or nil if not found.
func (r *UserRepo) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(password_hash, ''), name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE email = $1
	`, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}

// GetUserByProviderID returns a user by OAuth provider and provider ID.
func (r *UserRepo) GetUserByProviderID(ctx context.Context, provider, providerID string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(password_hash, ''), name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE provider = $1 AND provider_id = $2
	`, provider, providerID).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user by provider: %w", err)
	}
	return u, nil
}

// GetUserByID returns a user by UUID.
func (r *UserRepo) GetUserByID(ctx context.Context, id string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(password_hash, ''), name, avatar_url, provider, provider_id, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return u, nil
}

// UpsertOAuthUser creates or updates a user from OAuth data. Returns the user.
func (r *UserRepo) UpsertOAuthUser(ctx context.Context, email, name, avatarURL, provider, providerID string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, avatar_url, provider, provider_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url,
			provider = EXCLUDED.provider,
			provider_id = EXCLUDED.provider_id,
			updated_at = NOW()
		RETURNING id, email, COALESCE(password_hash, ''), name, avatar_url, provider, provider_id, created_at, updated_at
	`, email, name, avatarURL, provider, providerID).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL,
		&u.Provider, &u.ProviderID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert oauth user: %w", err)
	}
	return u, nil
}
