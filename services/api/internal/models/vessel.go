package models

// VesselEntity represents a single vessel position update from AIS data.
type VesselEntity struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Callsign    string  `json:"callsign"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Speed       float64 `json:"speed"`
	Course      float64 `json:"course"`
	Heading     float64 `json:"heading"`
	ShipType    int     `json:"shipType"`
	IMO         int     `json:"imo"`
	Destination string  `json:"destination"`
	Length      float64 `json:"length"`
	Width       float64 `json:"width"`
	Draught     float64 `json:"draught"`
	NavStatus   int     `json:"navStatus"`
}
