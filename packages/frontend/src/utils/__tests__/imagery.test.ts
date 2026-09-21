import { describe, it, expect } from 'vitest'
import { resolveImageryTier } from '../imagery'

describe('resolveImageryTier', () => {
  it('falls back to the bundled imagery when no keys are set', () => {
    // This is the path a fresh clone takes, so it must never need a network key.
    expect(resolveImageryTier({ cesiumIonToken: undefined, googleMapsApiKey: undefined })).toBe(
      'default',
    )
  })

  it('uses Ion when only the Ion token is set', () => {
    expect(resolveImageryTier({ cesiumIonToken: 'tok', googleMapsApiKey: undefined })).toBe('ion')
  })

  it('uses Google when only the Maps key is set', () => {
    expect(resolveImageryTier({ cesiumIonToken: undefined, googleMapsApiKey: 'key' })).toBe(
      'google3d',
    )
  })

  it('prefers Google when both keys are set', () => {
    // Provisioning a Map Tiles key is deliberate work; honour it over Ion.
    expect(resolveImageryTier({ cesiumIonToken: 'tok', googleMapsApiKey: 'key' })).toBe('google3d')
  })
})
