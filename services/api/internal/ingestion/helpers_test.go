package ingestion

import (
	"testing"
	"time"
)

func TestBackoffGrowsAndClamps(t *testing.T) {
	base := 1 * time.Second
	max := 30 * time.Second

	// Backoff returns exp/2 + jitter where jitter < exp/2, so the result always
	// lands in [exp/2, exp) with exp = base<<failures capped at max.
	tests := []struct {
		failures int
		wantMin  time.Duration
		wantMax  time.Duration
	}{
		{0, 500 * time.Millisecond, 1 * time.Second},
		{1, 1 * time.Second, 2 * time.Second},
		{2, 2 * time.Second, 4 * time.Second},
		{3, 4 * time.Second, 8 * time.Second},
		{5, 15 * time.Second, 30 * time.Second},
		// base<<5 == 32s already exceeds max, so everything past here is clamped.
		{6, 15 * time.Second, 30 * time.Second},
		{20, 15 * time.Second, 30 * time.Second},
	}

	for _, tt := range tests {
		// Sample repeatedly: the jitter is random, so a single call proves little.
		for i := 0; i < 100; i++ {
			got := Backoff(tt.failures, base, max)
			if got < tt.wantMin || got >= tt.wantMax {
				t.Fatalf("Backoff(%d) = %v, want in [%v, %v)",
					tt.failures, got, tt.wantMin, tt.wantMax)
			}
			if got > max {
				t.Fatalf("Backoff(%d) = %v, exceeds max %v", tt.failures, got, max)
			}
		}
	}
}

func TestBackoffHugeFailureCountStaysClamped(t *testing.T) {
	base := 1 * time.Second
	max := 30 * time.Second

	// A shift of 64 or more wipes the value to zero (or flips it negative), which
	// the exp <= 0 guard has to catch — otherwise the delay would collapse to
	// nothing and the worker would hammer the upstream API.
	for _, failures := range []int{63, 64, 65, 128, 1000} {
		got := Backoff(failures, base, max)
		if got < max/2 || got > max {
			t.Errorf("Backoff(%d) = %v, want in [%v, %v]", failures, got, max/2, max)
		}
	}
}

func TestBackoffRespectsSmallMax(t *testing.T) {
	// When max is below base, the clamp must still win.
	base := 10 * time.Second
	max := 2 * time.Second

	for i := 0; i < 50; i++ {
		got := Backoff(3, base, max)
		if got > max {
			t.Fatalf("Backoff = %v, exceeds max %v", got, max)
		}
		if got < max/2 {
			t.Fatalf("Backoff = %v, below half of max %v", got, max)
		}
	}
}
