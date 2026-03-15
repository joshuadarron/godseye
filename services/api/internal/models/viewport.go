package models

// ViewportMessage is a client-to-server message reporting the camera viewport.
type ViewportMessage struct {
	Type   string         `json:"type"`
	Bounds ViewportBounds `json:"bounds"`
}

// ViewportBounds describes the geographic rectangle visible to a client.
type ViewportBounds struct {
	West  float64 `json:"west"`
	South float64 `json:"south"`
	East  float64 `json:"east"`
	North float64 `json:"north"`
}

// Contains checks whether a lat/lng point falls within the viewport bounds.
// Handles the anti-meridian case where West > East.
func (b *ViewportBounds) Contains(lat, lng float64) bool {
	if lat < b.South || lat > b.North {
		return false
	}
	if b.West <= b.East {
		return lng >= b.West && lng <= b.East
	}
	// Anti-meridian crossing: viewport wraps around the date line.
	return lng >= b.West || lng <= b.East
}
