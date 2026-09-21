/**
 * Installs the basemap chosen by `resolveImageryTier` onto a live viewer.
 *
 * Everything here runs after the viewer exists, never at module scope. Commit
 * 5152afc lost the globe by building an imagery layer at import time and
 * handing it to the readonly `baseLayer` prop, where it outlived the viewer it
 * was built for across a StrictMode remount.
 */

import {
  Ion,
  ImageryLayer,
  Terrain,
  TileMapServiceImageryProvider,
  buildModuleUrl,
  createWorldImageryAsync,
  type Viewer,
} from 'cesium'
import type { ImageryTier } from './imagery'

let warnedAboutGoogle = false

/** Cesium's bundled low-resolution world imagery. No key, no network beyond our own origin. */
function naturalEarth(): ImageryLayer {
  return ImageryLayer.fromProviderAsync(
    TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
    {},
  )
}

/**
 * Apply `tier` to `viewer`. Safe to call from an effect: it re-checks the
 * viewer before touching it, so a teardown mid-await is a no-op.
 *
 * `google3d` resolves but does not render yet. Photorealistic 3D Tiles are a
 * `scene.primitives` tileset rather than an imagery layer, and Cesium gates
 * them on its Google geocoder, which this viewer disables. Until that is wired
 * up properly, fall through to the next tier that works.
 */
export async function applyImageryTier(
  viewer: Viewer,
  tier: ImageryTier,
  ionToken: string | undefined,
): Promise<void> {
  let effective = tier

  if (effective === 'google3d') {
    if (!warnedAboutGoogle) {
      warnedAboutGoogle = true
      console.warn(
        'VITE_GOOGLE_MAPS_API_KEY is set, but Google Photorealistic 3D Tiles are not wired up yet. Falling back.',
      )
    }
    effective = ionToken ? 'ion' : 'default'
  }

  if (effective === 'ion') {
    // Assign before constructing anything Ion-backed, or the request goes out unauthenticated.
    if (ionToken) Ion.defaultAccessToken = ionToken
    const provider = await createWorldImageryAsync()
    if (viewer.isDestroyed()) return
    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(provider)
    viewer.scene.setTerrain(Terrain.fromWorldTerrain())
    return
  }

  if (viewer.isDestroyed()) return
  viewer.imageryLayers.removeAll()
  viewer.imageryLayers.add(naturalEarth())
}
