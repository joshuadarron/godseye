import type { Entity } from './common'

export interface Flight extends Entity {
  callsign: string
  originCountry: string
  altitude: number
  velocity: number
  heading: number
  onGround: boolean
  source: string
}
