package config

import "os"

// Config holds all configuration values loaded from environment variables.
type Config struct {
	DatabaseURL string
	RedisURL    string
	ServerAddr  string

	OpenSkyClientID     string
	OpenSkyClientSecret string

	AISHubUsername    string
	AISStreamAPIKey   string

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

		OpenSkyClientID:     os.Getenv("OPENSKY_CLIENT_ID"),
		OpenSkyClientSecret: os.Getenv("OPENSKY_CLIENT_SECRET"),

		AISHubUsername:    os.Getenv("AISHUB_USERNAME"),
		AISStreamAPIKey:   os.Getenv("AISSTREAM_API_KEY"),

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
