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

/** Vessel position update from AIS data. */
export interface Vessel extends Entity {
  name: string
  callsign: string
  speed: number
  course: number
  heading: number
  shipType: number
  imo: number
  destination: string
  length: number
  width: number
  draught: number
  navStatus: number
}

/** Earthquake event from USGS data. */
export interface Earthquake extends Entity {
  magnitude: number
  place: string
  depth: number
  time: string
  url: string
  alert: string
  tsunami: number
  significance: number
  magType: string
  status: string
}
