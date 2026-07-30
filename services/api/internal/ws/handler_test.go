package ws

import (
	"reflect"
	"testing"
)

func TestExtractOriginHosts(t *testing.T) {
	tests := []struct {
		name    string
		origins []string
		want    []string
	}{
		{
			name:    "strips scheme, keeps host and port",
			origins: []string{"http://localhost:5173", "https://godseye.example.com"},
			want:    []string{"localhost:5173", "godseye.example.com"},
		},
		{
			name:    "entries without a host are dropped",
			origins: []string{"http://localhost:5173", "not-a-url", ""},
			want:    []string{"localhost:5173"},
		},
		{
			// Guard against an origin list that yields nothing usable: the
			// fallback keeps local development working rather than silently
			// rejecting every upgrade.
			name:    "empty input falls back to localhost",
			origins: nil,
			want:    []string{"localhost:*"},
		},
		{
			name:    "all entries unusable falls back to localhost",
			origins: []string{"not-a-url", "also/not/a/url"},
			want:    []string{"localhost:*"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractOriginHosts(tt.origins)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("extractOriginHosts(%q) = %q, want %q", tt.origins, got, tt.want)
			}
		})
	}
}

func TestParseSubprotocols(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   []string
	}{
		{"empty header", "", nil},
		{"single value", "godseye.v1", []string{"godseye.v1"}},
		{
			"comma separated with spaces",
			"godseye.v1, godseye.v1.tok3n",
			[]string{"godseye.v1", "godseye.v1.tok3n"},
		},
		{
			"empty segments are dropped",
			"godseye.v1,,  ,godseye.v1.tok3n",
			[]string{"godseye.v1", "godseye.v1.tok3n"},
		},
		{"only separators", ",,,", []string{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseSubprotocols(tt.header)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("parseSubprotocols(%q) = %q, want %q", tt.header, got, tt.want)
			}
		})
	}
}
