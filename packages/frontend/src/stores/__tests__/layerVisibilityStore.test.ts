import { describe, it, expect, beforeEach } from 'vitest'
import { useLayerVisibilityStore, FLIGHT_SUBTYPES } from '../layerVisibilityStore'

const allFlightSubtypesOn = () =>
  Object.fromEntries(Object.keys(FLIGHT_SUBTYPES).map((k) => [k, true]))

describe('layerVisibilityStore', () => {
  beforeEach(() => {
    useLayerVisibilityStore.setState({
      layers: {
        flights: false,
        satellites: false,
        vessels: false,
        trains: false,
        events: false,
        conflicts: false,
      },
      sublayers: { flights: allFlightSubtypesOn() },
    })
  })

  it('starts with every layer off', () => {
    const { layers } = useLayerVisibilityStore.getState()
    expect(Object.values(layers).every((on) => on === false)).toBe(true)
  })

  it('toggles a layer on and off', () => {
    useLayerVisibilityStore.getState().toggle('flights')
    expect(useLayerVisibilityStore.getState().layers.flights).toBe(true)

    useLayerVisibilityStore.getState().toggle('flights')
    expect(useLayerVisibilityStore.getState().layers.flights).toBe(false)
  })

  it('re-enables all sublayers when a layer is switched on', () => {
    // Otherwise a user who deselected every subtype, hid the layer, then showed
    // it again would see nothing and have no obvious way to recover.
    useLayerVisibilityStore.getState().setAllSublayers('flights', false)
    useLayerVisibilityStore.getState().toggle('flights')

    const { sublayers } = useLayerVisibilityStore.getState()
    expect(Object.values(sublayers.flights).every((on) => on === true)).toBe(true)
  })

  it('leaves sublayers untouched when a layer is switched off', () => {
    useLayerVisibilityStore.getState().toggle('flights')
    useLayerVisibilityStore.getState().toggleSublayer('flights', 'cessna')
    useLayerVisibilityStore.getState().toggle('flights')

    expect(useLayerVisibilityStore.getState().sublayers.flights.cessna).toBe(false)
  })

  it('toggles an individual sublayer', () => {
    useLayerVisibilityStore.getState().toggleSublayer('flights', 'cessna')
    expect(useLayerVisibilityStore.getState().sublayers.flights.cessna).toBe(false)

    useLayerVisibilityStore.getState().toggleSublayer('flights', 'cessna')
    expect(useLayerVisibilityStore.getState().sublayers.flights.cessna).toBe(true)
  })

  it('setAllSublayers sets every subtype at once', () => {
    useLayerVisibilityStore.getState().setAllSublayers('flights', false)
    expect(Object.values(useLayerVisibilityStore.getState().sublayers.flights)).not.toContain(true)

    useLayerVisibilityStore.getState().setAllSublayers('flights', true)
    expect(Object.values(useLayerVisibilityStore.getState().sublayers.flights)).not.toContain(false)
  })

  it('isSublayerVisible returns false while the parent layer is off', () => {
    // The parent layer gates everything, regardless of subtype state.
    expect(useLayerVisibilityStore.getState().isSublayerVisible('flights', 'cessna')).toBe(false)
  })

  it('isSublayerVisible follows the subtype once the layer is on', () => {
    useLayerVisibilityStore.getState().toggle('flights')
    expect(useLayerVisibilityStore.getState().isSublayerVisible('flights', 'cessna')).toBe(true)

    useLayerVisibilityStore.getState().toggleSublayer('flights', 'cessna')
    expect(useLayerVisibilityStore.getState().isSublayerVisible('flights', 'cessna')).toBe(false)
  })

  it('defaults unknown sublayers to visible when the layer is on', () => {
    useLayerVisibilityStore.getState().toggle('flights')
    expect(useLayerVisibilityStore.getState().isSublayerVisible('flights', 'brand-new')).toBe(true)
  })
})
