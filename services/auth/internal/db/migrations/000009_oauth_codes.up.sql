-- Short-lived, single-use authorization codes for the OAuth redirect handoff.
-- Only the code hash and the user it belongs to are stored — tokens are minted
-- at exchange time, so no token material ever sits at rest or in a redirect URL.
CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash  TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_codes_expires ON oauth_codes (expires_at);
