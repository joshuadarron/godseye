package models

import "testing"

func TestViewportBoundsContains(t *testing.T) {
	// A normal viewport over western Europe.
	europe := &ViewportBounds{West: -10, South: 35, East: 20, North: 60}

	// A viewport crossing the anti-meridian, e.g. centred on Fiji.
	dateline := &ViewportBounds{West: 170, South: -25, East: -170, North: -10}

	tests := []struct {
		name   string
		bounds *ViewportBounds
		lat    float64
		lng    float64
		want   bool
	}{
		{"inside", europe, 48, 2, true},
		{"north of viewport", europe, 61, 2, false},
		{"south of viewport", europe, 34, 2, false},
		{"west of viewport", europe, 48, -11, false},
		{"east of viewport", europe, 48, 21, false},

		// Edges are inclusive on all four sides.
		{"on south edge", europe, 35, 0, true},
		{"on north edge", europe, 60, 0, true},
		{"on west edge", europe, 48, -10, true},
		{"on east edge", europe, 48, 20, true},

		// Anti-meridian: the viewport wraps, so longitude matches when it is
		// east of West *or* west of East, rather than between them.
		{"dateline, east of west edge", dateline, -18, 175, true},
		{"dateline, west of east edge", dateline, -18, -175, true},
		{"dateline, on west edge", dateline, -18, 170, true},
		{"dateline, on east edge", dateline, -18, -170, true},
		{"dateline, in the excluded middle", dateline, -18, 0, false},
		{"dateline, just outside west edge", dateline, -18, 169, false},
		{"dateline, just outside east edge", dateline, -18, -169, false},
		{"dateline, longitude ok but latitude out", dateline, -30, 175, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.bounds.Contains(tt.lat, tt.lng); got != tt.want {
				t.Errorf("Contains(%v, %v) = %v, want %v", tt.lat, tt.lng, got, tt.want)
			}
		})
	}
}

func TestViewportBoundsContainsWholeWorld(t *testing.T) {
	world := &ViewportBounds{West: -180, South: -90, East: 180, North: 90}

	corners := [][2]float64{
		{-90, -180}, {-90, 180}, {90, -180}, {90, 180}, {0, 0},
	}
	for _, c := range corners {
		if !world.Contains(c[0], c[1]) {
			t.Errorf("world viewport should contain (%v, %v)", c[0], c[1])
		}
	}
}
