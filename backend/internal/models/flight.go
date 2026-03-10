package models

// FlightEntity represents a single flight position update.
type FlightEntity struct {
	ID            string  `json:"id"`
	Callsign      string  `json:"callsign"`
	OriginCountry string  `json:"originCountry"`
	Lat           float64 `json:"lat"`
	Lng           float64 `json:"lng"`
	Altitude      float64 `json:"altitude"`
	Velocity      float64 `json:"velocity"`
	Heading       float64 `json:"heading"`
	OnGround      bool    `json:"onGround"`
	Source        string  `json:"source"`
}
