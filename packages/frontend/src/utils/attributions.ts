import type { LayerAttribution } from '../registries/layerRegistry'

/** Just enough of a registration to credit it, so tests need no real layer modules. */
interface AttributableLayer {
  attribution?: LayerAttribution
}

/**
 * Credits for the layers currently on screen, in registry order.
 *
 * Kept separate from the component so it can be tested without rendering, and
 * because the two lookups it guards against are easy to get wrong:
 * a visible layer may have no registration at all (`trains` is toggleable but
 * unregistered), and a registered layer may carry no attribution.
 */
export function visibleAttributions(
  layers: Record<string, boolean>,
  registry: ReadonlyMap<string, AttributableLayer>,
): LayerAttribution[] {
  const seen = new Set<string>()
  const result: LayerAttribution[] = []

  for (const [key, registration] of registry) {
    // Default to hidden. The store starts every layer off, so an unknown key
    // means "not on screen", and crediting it would be a lie.
    if (!(layers[key] ?? false)) continue

    const attribution = registration.attribution
    if (!attribution || seen.has(attribution.label)) continue

    seen.add(attribution.label)
    result.push(attribution)
  }

  return result
}
