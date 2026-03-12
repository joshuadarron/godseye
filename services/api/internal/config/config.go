package config

import "os"

// Config holds all configuration values loaded from environment variables.
type Config struct {
	DatabaseURL string
	RedisURL    string
	ServerAddr  string

	OpenSkyUsername  string
	OpenSkyPassword string

	AISHubUsername string

	ACLEDAPIKey         string
	TicketmasterAPIKey  string
	PredictHQAPIKey     string
	OpenWeatherAPIKey   string
}

// Load reads configuration from environment variables, applying defaults where appropriate.
func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://godseye:godseye@localhost:5432/globaltracker"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		ServerAddr:  getEnv("SERVER_ADDR", ":8080"),

		OpenSkyUsername:  os.Getenv("OPENSKY_USERNAME"),
		OpenSkyPassword:  os.Getenv("OPENSKY_PASSWORD"),

		AISHubUsername: os.Getenv("AISHUB_USERNAME"),

		ACLEDAPIKey:         os.Getenv("ACLED_API_KEY"),
		TicketmasterAPIKey:  os.Getenv("TICKETMASTER_API_KEY"),
		PredictHQAPIKey:     os.Getenv("PREDICTHQ_API_KEY"),
		OpenWeatherAPIKey:   os.Getenv("OPENWEATHER_API_KEY"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
