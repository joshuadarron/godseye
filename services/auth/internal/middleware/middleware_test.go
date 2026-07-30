package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var allowedOrigins = []string{"http://localhost:5173", "http://localhost:3000"}

func noopHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestChainAppliesMiddlewareOutermostFirst(t *testing.T) {
	var order []string

	record := func(name string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
				order = append(order, name+":after")
			})
		}
	}

	handler := Chain(record("first"), record("second"), record("third"))(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "handler")
		}),
	)

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	// The first argument must be the outermost wrapper, so it runs first on the
	// way in and last on the way out.
	want := []string{
		"first", "second", "third",
		"handler",
		"third:after", "second:after", "first:after",
	}
	if strings.Join(order, ",") != strings.Join(want, ",") {
		t.Errorf("order = %v, want %v", order, want)
	}
}

func TestCORSWithOriginsAllowedOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/flights", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()

	CORSWithOrigins(allowedOrigins)(noopHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Allow-Origin = %q, want the request origin echoed back", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Allow-Credentials = %q, want %q", got, "true")
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary = %q, want %q", got, "Origin")
	}
}

func TestCORSWithOriginsDisallowedOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/flights", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()

	reached := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true })
	CORSWithOrigins(allowedOrigins)(next).ServeHTTP(rec, req)

	// The header is simply withheld — the browser is what enforces the block, so
	// the request still reaches the handler.
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want it withheld for a disallowed origin", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Allow-Credentials = %q, want it withheld", got)
	}
	if !reached {
		t.Error("handler was not reached")
	}
	// Vary must be set regardless, or a cache could serve one origin's response
	// to another.
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary = %q, want %q", got, "Origin")
	}
}

func TestCORSWithOriginsNoOriginHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/flights", nil)
	rec := httptest.NewRecorder()

	CORSWithOrigins(allowedOrigins)(noopHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty for a same-origin request", got)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestCORSWithOriginsPreflightShortCircuits(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/flights", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()

	reached := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true })
	CORSWithOrigins(allowedOrigins)(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if reached {
		t.Error("preflight reached the downstream handler; it should short-circuit")
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Error("Allow-Methods missing from the preflight response")
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "Authorization") {
		t.Errorf("Allow-Headers = %q, want it to include Authorization", got)
	}
}

func TestCORSWithEmptyAllowListRejectsEverything(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/flights", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()

	CORSWithOrigins(nil)(noopHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want empty when nothing is allow-listed", got)
	}
}

func TestSecurityHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	SecurityHeaders(noopHandler()).ServeHTTP(rec, req)

	want := map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Content-Security-Policy":   "default-src 'self'",
		"Strict-Transport-Security": "max-age=63072000; includeSubDomains",
	}
	for header, value := range want {
		if got := rec.Header().Get(header); got != value {
			t.Errorf("%s = %q, want %q", header, got, value)
		}
	}
}

func TestRequestIDGeneratesWhenAbsent(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	var seenByHandler string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenByHandler = r.Header.Get("X-Request-ID")
	})
	RequestID(next).ServeHTTP(rec, req)

	if seenByHandler == "" {
		t.Fatal("downstream handler saw no X-Request-ID on the request")
	}
	if got := rec.Header().Get("X-Request-ID"); got != seenByHandler {
		t.Errorf("response ID %q does not match request ID %q", got, seenByHandler)
	}
	if len(seenByHandler) != 16 {
		t.Errorf("generated ID %q has length %d, want 16 hex chars", seenByHandler, len(seenByHandler))
	}
}

func TestRequestIDEchoesExisting(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", "caller-supplied-id")
	rec := httptest.NewRecorder()

	RequestID(noopHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Request-ID"); got != "caller-supplied-id" {
		t.Errorf("X-Request-ID = %q, want the caller's value preserved", got)
	}
}

func TestRequestIDIsUniquePerRequest(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		rec := httptest.NewRecorder()
		RequestID(noopHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

		id := rec.Header().Get("X-Request-ID")
		if seen[id] {
			t.Fatalf("duplicate request ID generated: %q", id)
		}
		seen[id] = true
	}
}

func TestLoggingCapturesStatus(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		w.Write([]byte("short and stout"))
	})
	Logging(next).ServeHTTP(rec, req)

	// The status must survive the statusWriter wrapper and reach the client.
	if rec.Code != http.StatusTeapot {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusTeapot)
	}
	if body := rec.Body.String(); body != "short and stout" {
		t.Errorf("body = %q, want the handler's output passed through", body)
	}
}

func TestStatusWriterHijackFailsOnNonHijacker(t *testing.T) {
	// httptest.ResponseRecorder is not an http.Hijacker, so the wrapper must
	// return an error rather than panicking on the type assertion.
	sw := &statusWriter{ResponseWriter: httptest.NewRecorder(), status: http.StatusOK}

	conn, buf, err := sw.Hijack()
	if err == nil {
		t.Fatal("expected an error hijacking a non-hijackable ResponseWriter")
	}
	if conn != nil || buf != nil {
		t.Error("expected nil conn and buffer alongside the error")
	}
}

func TestStatusWriterFlushIsSafeOnNonFlusher(t *testing.T) {
	// Must be a no-op rather than a panic when the underlying writer cannot flush.
	sw := &statusWriter{ResponseWriter: nonFlusher{}, status: http.StatusOK}
	sw.Flush()
}

// nonFlusher is a minimal ResponseWriter that implements neither Flusher nor Hijacker.
type nonFlusher struct{}

func (nonFlusher) Header() http.Header         { return http.Header{} }
func (nonFlusher) Write(b []byte) (int, error) { return len(b), nil }
func (nonFlusher) WriteHeader(int)             {}
