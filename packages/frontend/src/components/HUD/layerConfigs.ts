import type { ReactNode } from 'react'
import { createElement } from 'react'
import { layerRegistry, type LayerRegistration } from '../../registries/layerRegistry'

// Import registrations so the registry is populated.
import '../../registries/flights'
import '../../registries/satellites'
import '../../registries/vessels'
import '../../registries/events'
import '../../registries/conflicts'

export interface LayerConfig {
  key: string
  label: string
  icon: ReactNode
  subtypes?: Record<string, string>
  subtypeIcons?: Record<string, string>
}

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

/** Static layer entries for layers not yet backed by data. */
const PLACEHOLDER_LAYERS: LayerRegistration[] = [
  {
    key: 'trains',
    label: 'Trains',
    icon: createElement(
      'svg',
      { className: ICON_CLASS, viewBox: '0 0 24 24' },
      createElement('path', {
        d: 'M8 21l-2-3M16 21l2-3M7 4h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM4 12h16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.5',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      createElement('circle', { cx: '8.5', cy: '15', r: '1', fill: 'currentColor' }),
      createElement('circle', { cx: '15.5', cy: '15', r: '1', fill: 'currentColor' }),
      createElement('path', {
        d: 'M9 4h6v4H9z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.5',
        strokeLinejoin: 'round',
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
      subtypeIcons: reg.subtypeIcons,
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
