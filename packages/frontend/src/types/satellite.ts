import type { Entity } from './common'

export interface Satellite extends Entity {
  name: string
  altitude: number
  velocity: number
  noradId: number
}
