package models

// EarthquakeEntity represents an earthquake event from the USGS API.
type EarthquakeEntity struct {
	ID           string  `json:"id"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	Magnitude    float64 `json:"magnitude"`
	Place        string  `json:"place"`
	Depth        float64 `json:"depth"`
	Time         string  `json:"time"`
	URL          string  `json:"url"`
	Alert        string  `json:"alert"`
	Tsunami      int     `json:"tsunami"`
	Significance int     `json:"significance"`
	MagType      string  `json:"magType"`
	Status       string  `json:"status"`
}
