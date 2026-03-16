package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"nhooyr.io/websocket"

	"github.com/joshuaferrara/godseye/services/api/internal/models"
)

const (
	aisStreamURL       = "wss://stream.aisstream.io/v0/stream"
	vesselRedisChannel = "channel:vessels"
	vesselPublishRate  = 5 * time.Second
	vesselPersistRate  = 30 * time.Second
)

// aisStreamMessage is the envelope returned by aisstream.io.
type aisStreamMessage struct {
	MessageType string          `json:"MessageType"`
	MetaData    aisMetaData     `json:"MetaData"`
	Message     json.RawMessage `json:"Message"`
}

type aisMetaData struct {
	MMSI       int    `json:"MMSI"`
	ShipName   string `json:"ShipName"`
	IMO        int    `json:"IMO"`
}

type aisPositionReport struct {
	Cog              float64 `json:"Cog"`
	Sog              float64 `json:"Sog"`
	TrueHeading      int     `json:"TrueHeading"`
	Latitude         float64 `json:"Latitude"`
	Longitude        float64 `json:"Longitude"`
	NavigationalStatus int   `json:"NavigationalStatus"`
}

type aisShipStaticData struct {
	Name        string  `json:"Name"`
	CallSign    string  `json:"CallSign"`
	Type        int     `json:"Type"`
	IMONumber   int     `json:"ImoNumber"`
	Destination string  `json:"Destination"`
	Draught     float64 `json:"Draught"`
	Dimension   aisDimension `json:"Dimension"`
}

type aisDimension struct {
	A int `json:"A"`
	B int `json:"B"`
	C int `json:"C"`
	D int `json:"D"`
}

// vesselState holds the merged position + static data for a vessel.
type vesselState struct {
	models.VesselEntity
	updated time.Time
}

// VesselWorker connects to aisstream.io and publishes vessel deltas.
type VesselWorker struct {
	pool   *pgxpool.Pool
	rdb    *redis.Client
	apiKey string

	mu       sync.Mutex
	vessels  map[string]*vesselState
	failures int
}

// NewVesselWorker creates a new VesselWorker. If apiKey is empty, the worker is a no-op.
func NewVesselWorker(pool *pgxpool.Pool, rdb *redis.Client, apiKey string) *VesselWorker {
	return &VesselWorker{
		pool:    pool,
		rdb:     rdb,
		apiKey:  apiKey,
		vessels: make(map[string]*vesselState),
	}
}

func (w *VesselWorker) Name() string { return "vessels" }

func (w *VesselWorker) Start(ctx context.Context) error {
	if w.apiKey == "" {
		slog.Info("vessel worker disabled: AISSTREAM_API_KEY not set")
		<-ctx.Done()
		return nil
	}

	for {
		if err := w.run(ctx); err != nil && ctx.Err() == nil {
			w.failures++
			bo := Backoff(w.failures, time.Second, maxBackoffDuration)
			slog.Error("vessel stream error", "error", err, "failures", w.failures, "backoff", bo)
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(bo):
			}
		}
		if ctx.Err() != nil {
			return nil
		}
	}
}

func (w *VesselWorker) run(ctx context.Context) error {
	conn, _, err := websocket.Dial(ctx, aisStreamURL, nil)
	if err != nil {
		return fmt.Errorf("dial aisstream: %w", err)
	}
	defer conn.CloseNow()

	// Allow large messages from AIS stream.
	conn.SetReadLimit(1 << 20) // 1 MB

	// Send subscription.
	sub := map[string]interface{}{
		"APIKey": w.apiKey,
		"BoundingBoxes": [][][2]float64{
			{{-90, -180}, {90, 180}},
		},
	}
	subData, _ := json.Marshal(sub)
	if err := conn.Write(ctx, websocket.MessageText, subData); err != nil {
		return fmt.Errorf("send subscription: %w", err)
	}
	slog.Info("connected to aisstream.io")
	w.failures = 0

	// Start publish and persist tickers.
	publishTicker := time.NewTicker(vesselPublishRate)
	defer publishTicker.Stop()
	persistTicker := time.NewTicker(vesselPersistRate)
	defer persistTicker.Stop()

	// Read messages in a goroutine, publish/persist on tickers.
	msgCh := make(chan []byte, 512)
	errCh := make(chan error, 1)

	go func() {
		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				errCh <- err
				return
			}
			select {
			case msgCh <- data:
			default:
				// Drop message if buffer is full.
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			conn.Close(websocket.StatusNormalClosure, "shutting down")
			return nil

		case err := <-errCh:
			return fmt.Errorf("read: %w", err)

		case data := <-msgCh:
			w.handleMessage(data)

		case <-publishTicker.C:
			w.publishDeltas(ctx)

		case <-persistTicker.C:
			w.persist(ctx)
		}
	}
}

func (w *VesselWorker) handleMessage(data []byte) {
	var msg aisStreamMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	mmsi := strconv.Itoa(msg.MetaData.MMSI)
	if mmsi == "0" {
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	v, exists := w.vessels[mmsi]
	if !exists {
		v = &vesselState{}
		v.ID = mmsi
		w.vessels[mmsi] = v
	}
	v.updated = time.Now()

	// Always apply metadata.
	if msg.MetaData.ShipName != "" {
		v.Name = strings.TrimSpace(msg.MetaData.ShipName)
	}
	if msg.MetaData.IMO != 0 {
		v.IMO = msg.MetaData.IMO
	}

	switch msg.MessageType {
	case "PositionReport", "StandardClassBCSPositionReport", "ExtendedClassBCSPositionReport":
		var pr aisPositionReport
		if err := json.Unmarshal(msg.Message, &pr); err != nil {
			return
		}
		if pr.Latitude < -90 || pr.Latitude > 90 || pr.Longitude < -180 || pr.Longitude > 180 {
			return
		}
		v.Lat = pr.Latitude
		v.Lng = pr.Longitude
		v.Speed = pr.Sog
		v.Course = pr.Cog
		if pr.TrueHeading != 511 { // 511 = not available
			v.Heading = float64(pr.TrueHeading)
		}
		v.NavStatus = pr.NavigationalStatus

	case "ShipStaticData":
		var sd aisShipStaticData
		if err := json.Unmarshal(msg.Message, &sd); err != nil {
			return
		}
		if sd.Name != "" {
			v.Name = strings.TrimSpace(sd.Name)
		}
		if sd.CallSign != "" {
			v.Callsign = strings.TrimSpace(sd.CallSign)
		}
		v.ShipType = sd.Type
		if sd.IMONumber != 0 {
			v.IMO = sd.IMONumber
		}
		if sd.Destination != "" {
			v.Destination = strings.TrimSpace(sd.Destination)
		}
		v.Draught = sd.Draught
		v.Length = float64(sd.Dimension.A + sd.Dimension.B)
		v.Width = float64(sd.Dimension.C + sd.Dimension.D)
	}
}

func (w *VesselWorker) publishDeltas(ctx context.Context) {
	w.mu.Lock()
	// Collect all vessels with valid positions.
	var entities []models.VesselEntity
	for _, v := range w.vessels {
		if v.Lat == 0 && v.Lng == 0 {
			continue // No position yet.
		}
		entities = append(entities, v.VesselEntity)
	}
	w.mu.Unlock()

	if len(entities) == 0 {
		return
	}

	slog.Debug("publishing vessels", "count", len(entities))

	// Publish in batches of 2000.
	const batchSize = 2000
	for i := 0; i < len(entities); i += batchSize {
		end := i + batchSize
		if end > len(entities) {
			end = len(entities)
		}
		batch := entities[i:end]

		anyEntities := make([]any, len(batch))
		for j, e := range batch {
			anyEntities[j] = e
		}

		if err := PublishDelta(ctx, w.rdb, vesselRedisChannel, "vessels", "upsert", anyEntities); err != nil {
			LogPublishError("vessels", err)
		}
	}
}

func (w *VesselWorker) persist(ctx context.Context) {
	w.mu.Lock()
	var entities []models.VesselEntity
	for _, v := range w.vessels {
		if v.Lat == 0 && v.Lng == 0 {
			continue
		}
		entities = append(entities, v.VesselEntity)
	}
	w.mu.Unlock()

	if len(entities) == 0 {
		return
	}

	now := time.Now()
	const batchSize = 1000
	for start := 0; start < len(entities); start += batchSize {
		end := start + batchSize
		if end > len(entities) {
			end = len(entities)
		}
		batch := entities[start:end]

		var sb strings.Builder
		sb.WriteString("INSERT INTO vessels (mmsi, name, callsign, position, speed, course, heading, ship_type, imo, destination, length, width, draught, nav_status, recorded_at) VALUES ")

		args := make([]interface{}, 0, len(batch)*16)
		for i, e := range batch {
			if i > 0 {
				sb.WriteString(",")
			}
			p := i * 16
			fmt.Fprintf(&sb, "($%d,$%d,$%d,ST_SetSRID(ST_MakePoint($%d,$%d),4326)::geography,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
				p+1, p+2, p+3, p+4, p+5, p+6, p+7, p+8, p+9, p+10, p+11, p+12, p+13, p+14, p+15, p+16)
			args = append(args, e.ID, e.Name, e.Callsign, e.Lng, e.Lat, e.Speed, e.Course, e.Heading, e.ShipType, e.IMO, e.Destination, e.Length, e.Width, e.Draught, e.NavStatus, now)
		}

		_, err := w.pool.Exec(ctx, sb.String(), args...)
		if err != nil {
			slog.Error("vessel persist error", "error", err)
		}
	}
}
