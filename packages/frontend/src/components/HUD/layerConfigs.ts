import type { ReactNode } from 'react'
import { createElement } from 'react'
import { layerRegistry, type LayerRegistration } from '../../registries/layerRegistry'

// Import registrations so the registry is populated.
import '../../registries/flights'
import '../../registries/satellites'

export interface LayerConfig {
  key: string
  label: string
  icon: ReactNode
  subtypes?: Record<string, string>
}

const ICON_CLASS = 'w-4 h-4 shrink-0 fill-current'

/** Static layer entries for layers not yet backed by data. */
const PLACEHOLDER_LAYERS: LayerRegistration[] = [
  {
    key: 'vessels',
    label: 'Vessels',
    icon: createElement('svg', { className: ICON_CLASS, viewBox: '0 0 24 24' },
      createElement('path', {
        d: 'M3 17l2 4h14l2-4H3zM12 3v10M8 7h8l2 6H6l2-6z',
        fill: 'none', stroke: 'currentColor', strokeWidth: '1.5',
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    ),
  } as any,
  {
    key: 'trains',
    label: 'Trains',
    icon: createElement('svg', { className: ICON_CLASS, viewBox: '0 0 24 24' },
      createElement('path', {
        d: 'M8 21l-2-3M16 21l2-3M7 4h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM4 12h16',
        fill: 'none', stroke: 'currentColor', strokeWidth: '1.5',
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
      createElement('circle', { cx: '8.5', cy: '15', r: '1', fill: 'currentColor' }),
      createElement('circle', { cx: '15.5', cy: '15', r: '1', fill: 'currentColor' }),
      createElement('path', {
        d: 'M9 4h6v4H9z', fill: 'none', stroke: 'currentColor',
        strokeWidth: '1.5', strokeLinejoin: 'round',
      }),
    ),
  } as any,
  {
    key: 'events',
    label: 'Events',
    icon: createElement('svg', { className: ICON_CLASS, viewBox: '0 0 24 24' },
      createElement('path', {
        d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
        fill: 'none', stroke: 'currentColor', strokeWidth: '1.5',
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    ),
  } as any,
]

export function buildLayerConfigs(): LayerConfig[] {
  const configs: LayerConfig[] = []

  for (const reg of layerRegistry.values()) {
    configs.push({
      key: reg.key,
      label: reg.label,
      icon: reg.icon,
      subtypes: reg.subtypes,
    })
  }

  for (const placeholder of PLACEHOLDER_LAYERS) {
    if (!layerRegistry.has(placeholder.key)) {
      configs.push({
        key: placeholder.key,
        label: placeholder.label,
        icon: placeholder.icon,
      })
    }
  }

  return configs
}

export const LAYERS = buildLayerConfigs()
