/**
 * The only place in the frontend that reads `import.meta.env`.
 *
 * Keeping env access in one module means a single place to see what the app
 * can be configured with, and a single place to change when a var is renamed.
 * Everything here is optional: the app runs with an empty `.env`, just with
 * fewer layers and the keyless base imagery.
 */

export interface AppConfig {
  /** Auth service base URL, e.g. http://localhost:8081. */
  authUrl: string | undefined
  /** WebSocket endpoint, e.g. ws://localhost:8080/ws. */
  wsUrl: string | undefined
  /** REST API base URL. When unset, callers derive it from `wsUrl`. */
  apiUrl: string | undefined
  /** Cesium Ion token. When set, the globe uses Ion world imagery and terrain. */
  cesiumIonToken: string | undefined
  /** Google Map Tiles API key, for Photorealistic 3D Tiles. */
  googleMapsApiKey: string | undefined
}

/** Treat an empty or whitespace-only var the same as an unset one. */
function optional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export const config: Readonly<AppConfig> = Object.freeze({
  authUrl: optional(import.meta.env.VITE_AUTH_URL),
  wsUrl: optional(import.meta.env.VITE_WS_URL),
  apiUrl: optional(import.meta.env.VITE_API_URL),
  cesiumIonToken: optional(import.meta.env.VITE_CESIUM_ION_TOKEN),
  googleMapsApiKey: optional(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
})
