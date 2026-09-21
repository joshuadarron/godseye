/**
 * Which basemap the globe should use, decided purely from configuration.
 *
 * Deliberately free of any `cesium` import so it stays cheap to unit-test:
 * the root vitest config does not load `vite-plugin-cesium`, so a Cesium
 * import here would try to resolve assets that are not served under test.
 * The Cesium side lives in `imageryLayer.ts`.
 */

import type { AppConfig } from '../config'

export type ImageryTier = 'default' | 'ion' | 'google3d'

/** Keys the tier decision depends on. Narrower than AppConfig so tests stay honest. */
export type ImageryConfig = Pick<AppConfig, 'cesiumIonToken' | 'googleMapsApiKey'>

/**
 * Highest tier whose key is present, else the keyless bundled imagery.
 *
 * Google wins over Ion when both are set: someone who went to the trouble of
 * provisioning a Map Tiles key wants the photorealistic tiles.
 */
export function resolveImageryTier(config: ImageryConfig): ImageryTier {
  if (config.googleMapsApiKey) return 'google3d'
  if (config.cesiumIonToken) return 'ion'
  return 'default'
}
