package models

// ConflictEntity represents an armed conflict event from the ACLED API.
type ConflictEntity struct {
	ID           string  `json:"id"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	EventDate    string  `json:"eventDate"`
	EventType    string  `json:"eventType"`
	SubEventType string  `json:"subEventType"`
	Actor1       string  `json:"actor1"`
	Actor2       string  `json:"actor2"`
	Country      string  `json:"country"`
	Admin1       string  `json:"admin1"`
	Location     string  `json:"location"`
	Fatalities   int     `json:"fatalities"`
	Notes        string  `json:"notes"`
	Source       string  `json:"source"`
	Timestamp    string  `json:"timestamp"`
}
