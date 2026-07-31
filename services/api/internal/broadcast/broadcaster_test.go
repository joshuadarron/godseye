package broadcast

import (
	"encoding/json"
	"testing"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

// newTestBroadcaster builds a Broadcaster with no Redis client. This is safe as
// long as Start is never called — it is the only method that touches rdb.
func newTestBroadcaster() *Broadcaster {
	return NewBroadcaster(nil)
}

// newTestClient builds a Client without a WebSocket connection. fanOut only ever
// touches send and bounds, so conn can stay nil.
func newTestClient(bufSize int, bounds *models.ViewportBounds) *Client {
	c := &Client{send: make(chan []byte, bufSize)}
	if bounds != nil {
		c.bounds.Store(bounds)
	}
	return c
}

// received drains whatever is waiting on the client's send channel.
func received(c *Client) [][]byte {
	var msgs [][]byte
	for {
		select {
		case msg := <-c.send:
			msgs = append(msgs, msg)
		default:
			return msgs
		}
	}
}

// entityIDs decodes a delta payload and returns the ids of its entities.
func entityIDs(t *testing.T, data []byte) []string {
	t.Helper()

	var envelope struct {
		Entities []struct {
			ID string `json:"id"`
		} `json:"entities"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatalf("decode delta: %v", err)
	}

	ids := make([]string, 0, len(envelope.Entities))
	for _, e := range envelope.Entities {
		ids = append(ids, e.ID)
	}
	return ids
}

// flightDelta is an upsert covering one entity in Europe and one in the Pacific.
const flightDelta = `{"layer":"flights","action":"upsert","entities":[` +
	`{"id":"europe","lat":48,"lng":2},` +
	`{"id":"pacific","lat":-18,"lng":175}]}`

var (
	europeBounds  = &models.ViewportBounds{West: -10, South: 35, East: 20, North: 60}
	pacificBounds = &models.ViewportBounds{West: 170, South: -25, East: -170, North: -10}
	saharaBounds  = &models.ViewportBounds{West: 0, South: 15, East: 10, North: 25}
)

func TestFanOutNoClients(t *testing.T) {
	// Must not panic or block when nobody is connected.
	newTestBroadcaster().fanOut([]byte(flightDelta))
}

func TestFanOutClientWithoutBoundsGetsEverything(t *testing.T) {
	b := newTestBroadcaster()
	c := newTestClient(4, nil)
	b.Register(c)

	b.fanOut([]byte(flightDelta))

	msgs := received(c)
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	// A client that has not reported a viewport gets the original bytes, unparsed.
	if string(msgs[0]) != flightDelta {
		t.Errorf("payload was modified for an unbounded client:\ngot  %s\nwant %s", msgs[0], flightDelta)
	}
}

func TestFanOutFiltersToViewport(t *testing.T) {
	b := newTestBroadcaster()
	europe := newTestClient(4, europeBounds)
	b.Register(europe)

	b.fanOut([]byte(flightDelta))

	msgs := received(europe)
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	ids := entityIDs(t, msgs[0])
	if len(ids) != 1 || ids[0] != "europe" {
		t.Errorf("entities = %v, want only [europe]", ids)
	}
}

func TestFanOutAntiMeridianViewport(t *testing.T) {
	b := newTestBroadcaster()
	pacific := newTestClient(4, pacificBounds)
	b.Register(pacific)

	b.fanOut([]byte(flightDelta))

	msgs := received(pacific)
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	ids := entityIDs(t, msgs[0])
	if len(ids) != 1 || ids[0] != "pacific" {
		t.Errorf("entities = %v, want only [pacific]", ids)
	}
}

func TestFanOutSkipsClientWhenNothingMatches(t *testing.T) {
	b := newTestBroadcaster()
	sahara := newTestClient(4, saharaBounds)
	b.Register(sahara)

	b.fanOut([]byte(flightDelta))

	// No entity is inside the viewport, so the client should get nothing at all
	// rather than an empty-entity envelope.
	if msgs := received(sahara); len(msgs) != 0 {
		t.Errorf("got %d messages, want 0: %s", len(msgs), msgs)
	}
}

func TestFanOutAllEntitiesMatchReusesOriginalBytes(t *testing.T) {
	b := newTestBroadcaster()
	// A viewport spanning the whole world matches both entities.
	world := newTestClient(4, &models.ViewportBounds{West: -180, South: -90, East: 180, North: 90})
	b.Register(world)

	b.fanOut([]byte(flightDelta))

	msgs := received(world)
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	// When everything matches, the original payload is forwarded without a
	// re-marshal round trip.
	if string(msgs[0]) != flightDelta {
		t.Errorf("payload was re-marshaled unnecessarily:\ngot  %s\nwant %s", msgs[0], flightDelta)
	}
}

func TestFanOutNonSpatialLayersAreNotFiltered(t *testing.T) {
	// Earthquakes and conflicts are point-in-time events rendered as static
	// markers; they must reach every client regardless of viewport.
	for _, layer := range []string{"events", "conflicts"} {
		delta := `{"layer":"` + layer + `","action":"upsert","entities":[{"id":"far-away","lat":-80,"lng":-170}]}`

		b := newTestBroadcaster()
		c := newTestClient(4, europeBounds)
		b.Register(c)

		b.fanOut([]byte(delta))

		msgs := received(c)
		if len(msgs) != 1 {
			t.Fatalf("layer %s: got %d messages, want 1", layer, len(msgs))
		}
		if string(msgs[0]) != delta {
			t.Errorf("layer %s: payload was filtered:\ngot  %s\nwant %s", layer, msgs[0], delta)
		}
	}
}

func TestFanOutRemoveActionIsNotFiltered(t *testing.T) {
	// A remove for an entity outside the viewport must still be delivered —
	// otherwise a client that has panned away keeps a stale entity forever.
	delta := `{"layer":"flights","action":"remove","entities":[{"id":"pacific","lat":-18,"lng":175}]}`

	b := newTestBroadcaster()
	c := newTestClient(4, europeBounds)
	b.Register(c)

	b.fanOut([]byte(delta))

	msgs := received(c)
	if len(msgs) != 1 {
		t.Fatalf("got %d messages, want 1", len(msgs))
	}
	if string(msgs[0]) != delta {
		t.Errorf("remove was filtered:\ngot  %s\nwant %s", msgs[0], delta)
	}
}

func TestFanOutUnparseablePayloadGoesToEveryone(t *testing.T) {
	b := newTestBroadcaster()
	bounded := newTestClient(4, europeBounds)
	unbounded := newTestClient(4, nil)
	b.Register(bounded)
	b.Register(unbounded)

	garbage := []byte("{not valid json")
	b.fanOut(garbage)

	// Both clients receive the raw bytes; the fallback must not drop traffic.
	for name, c := range map[string]*Client{"bounded": bounded, "unbounded": unbounded} {
		msgs := received(c)
		if len(msgs) == 0 {
			t.Errorf("%s client received nothing", name)
			continue
		}
		if string(msgs[0]) != string(garbage) {
			t.Errorf("%s client got %s, want the raw bytes", name, msgs[0])
		}
	}
}

func TestFanOutDropsSlowClient(t *testing.T) {
	b := newTestBroadcaster()

	// A zero-capacity channel with no reader is always "full", so the
	// non-blocking send fails immediately.
	slow := newTestClient(0, nil)
	healthy := newTestClient(4, nil)
	b.Register(slow)
	b.Register(healthy)

	b.fanOut([]byte(flightDelta))

	b.mu.RLock()
	_, slowStillRegistered := b.clients[slow]
	_, healthyStillRegistered := b.clients[healthy]
	b.mu.RUnlock()

	if slowStillRegistered {
		t.Error("slow client should have been unregistered")
	}
	if !healthyStillRegistered {
		t.Error("healthy client should still be registered")
	}
	if msgs := received(healthy); len(msgs) != 1 {
		t.Errorf("healthy client got %d messages, want 1", len(msgs))
	}
}

func TestRegisterAndUnregister(t *testing.T) {
	b := newTestBroadcaster()
	c := newTestClient(4, nil)

	b.Register(c)
	b.mu.RLock()
	_, ok := b.clients[c]
	b.mu.RUnlock()
	if !ok {
		t.Fatal("client was not registered")
	}

	b.Unregister(c)
	b.mu.RLock()
	_, ok = b.clients[c]
	b.mu.RUnlock()
	if ok {
		t.Fatal("client was not unregistered")
	}

	// The send channel must be closed so WritePump exits.
	if _, open := <-c.send; open {
		t.Error("send channel should be closed after unregistering")
	}

	// Unregistering twice must not panic on a double close — the map lookup
	// guards it.
	b.Unregister(c)
}

func TestNewBroadcasterDefaultChannels(t *testing.T) {
	if got := newTestBroadcaster().channels; len(got) != len(DefaultChannels) {
		t.Errorf("channels = %v, want the defaults %v", got, DefaultChannels)
	}

	custom := NewBroadcaster(nil, "channel:custom")
	if len(custom.channels) != 1 || custom.channels[0] != "channel:custom" {
		t.Errorf("channels = %v, want [channel:custom]", custom.channels)
	}
}

func TestClientBoundsNilUntilReported(t *testing.T) {
	if got := newTestClient(4, nil).Bounds(); got != nil {
		t.Errorf("Bounds() = %+v, want nil before any viewport message", got)
	}
}
