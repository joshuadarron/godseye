export interface DeltaMessage {
  layer: string
  action: 'upsert' | 'remove'
  entities: Entity[]
}

export interface Entity {
  id: string
  lat: number
  lng: number
  heading?: number
  pitch?: number
  roll?: number
  [key: string]: unknown
}
