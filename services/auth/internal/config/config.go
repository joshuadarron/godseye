package config

import (
	"net"
	"os"
	"strings"
	"time"
)

// Config holds all configuration values loaded from environment variables.
type Config struct {
	DatabaseURL     string
	ServerAddr      string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	GithubClientID     string
	GithubClientSecret string
	GoogleClientID     string
	GoogleClientSecret string

	FrontendURL    string
	AllowedOrigins []string
	OAuthBaseURL   string
}

// Load reads configuration from environment variables, applying defaults where appropriate.
func Load() *Config {
	return &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://godseye:godseye@localhost:5432/globaltracker?sslmode=disable"),
		ServerAddr:      getEnv("AUTH_SERVER_ADDR", ":8081"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		AccessTokenTTL:  parseDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL: parseDuration("REFRESH_TOKEN_TTL", 168*time.Hour),

		GithubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GithubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),

		FrontendURL:    getEnv("FRONTEND_URL", "http://localhost:5173"),
		AllowedOrigins: parseOrigins(getEnv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")),
		OAuthBaseURL:   getEnv("OAUTH_BASE_URL", defaultOAuthBaseURL(getEnv("AUTH_SERVER_ADDR", ":8081"))),
	}
}

// defaultOAuthBaseURL derives a browser-reachable base URL from the listen
// address, for use when OAUTH_BASE_URL is unset. A listen address may omit the
// host (":8081"), name one interface ("127.0.0.1:8081"), or bind all of them
// ("0.0.0.0:8081"); only the first form can be appended to "http://localhost"
// directly, which is what this used to do — "127.0.0.1:8081" produced the
// unusable "http://localhost127.0.0.1:8081".
func defaultOAuthBaseURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "http://localhost:8081"
	}
	// Wildcard binds aren't addresses a browser can be redirected to.
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "localhost"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func parseOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
