package models

// SatelliteEntity represents a computed satellite position.
type SatelliteEntity struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Altitude float64 `json:"altitude"`
	Velocity float64 `json:"velocity"`
	NoradID  int     `json:"noradId"`
	TLE1     string  `json:"tle1"`
	TLE2     string  `json:"tle2"`
}
