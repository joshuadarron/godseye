/** Base entity with a position on the globe. */
export interface Entity {
  id: string
  lat: number
  lng: number
  heading?: number
  pitch?: number
  roll?: number
}

/** A WebSocket delta payload sent from the server. */
export interface DeltaMessage {
  layer: string
  action: 'upsert' | 'remove'
  entities: Entity[]
}

/** Flight position update. */
export interface Flight extends Entity {
  callsign: string
  originCountry: string
  altitude: number
  velocity: number
  heading: number
  onGround: boolean
  source: string
  verticalRate: number
  geoAltitude: number
  squawk: string
  category: number
}

/** Computed satellite position derived from TLE propagation. */
export interface Satellite extends Entity {
  name: string
  altitude: number
  velocity: number
  noradId: number
  tle1: string
  tle2: string
}
