# Entity Icons

Place PNG icon files here for entity rendering on the globe. Icons are rendered as rotated billboards via CesiumJS `BillboardCollection` (GPU-instanced, scales to 100k+ entities).

## Expected Files

| Filename        | Entity Type |
| --------------- | ----------- |
| `aircraft.png`  | Flights     |
| `satellite.png` | Satellites  |
| `vessel.png`    | Ships       |
| `train.png`     | Trains      |

## Requirements

- **Format:** PNG with transparency
- **Size:** 64x64 or 128x128 px ideal (small = fast, billboard scaling handles the rest)
- **Orientation:** Icon should point **up** (north) — heading rotation is applied at runtime
- **Background:** Transparent

If no icon file is present, the layer falls back to colored point primitives automatically.
