import type { Viewer } from 'cesium'

let viewer: Viewer | null = null

export function setViewer(v: Viewer | null) {
  viewer = v
}

export function getViewer(): Viewer | null {
  return viewer
}
