import { useMemo } from 'react'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'
import type { LayerRegistration } from '../../registries/layerRegistry'

interface Props {
  registration: LayerRegistration
}

export default function GenericEntityLayer({ registration: reg }: Props) {
  const visible = useLayerVisibilityStore((s) => s.layers[reg.key])
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[reg.key])
  const entities = reg.store((s) => s.entities)

  const hasSubtypes = !!(reg.subtypes && reg.classifySubtype)

  // Group entities by subtype (or single group if no subtypes).
  const grouped = useMemo(() => {
    if (!hasSubtypes) {
      const map = new Map<string, ModelEntity>()
      entities.forEach((entity, id) => {
        map.set(id, reg.toModelEntity(entity))
      })
      return new Map([['__default', map]])
    }

    const groups = new Map<string, Map<string, ModelEntity>>()
    entities.forEach((entity, id) => {
      const subtype = reg.classifySubtype!(entity)
      if (sublayerMap && !sublayerMap[subtype]) return

      if (!groups.has(subtype)) groups.set(subtype, new Map())
      groups.get(subtype)!.set(id, reg.toModelEntity(entity))
    })
    return groups
  }, [entities, sublayerMap, hasSubtypes, reg])

  if (!visible) return null

  if (!hasSubtypes) {
    const map = grouped.get('__default')!
    return (
      <ModelLayer
        iconUrl={reg.iconUrl}
        entities={map}
        fallbackColor={reg.fallbackColor}
        fallbackPixelSize={reg.fallbackPixelSize}
        iconScale={reg.iconScale}
        headingOffset={reg.headingOffset}
        layerName={reg.key}
        disableRotation={reg.disableRotation}
      />
    )
  }

  return (
    <>
      {Array.from(grouped.entries()).map(([subtype, map]) => (
        <ModelLayer
          key={subtype}
          iconUrl={reg.subtypeIcons?.[subtype] ?? reg.iconUrl}
          entities={map}
          fallbackColor={reg.subtypeColors?.[subtype] ?? reg.fallbackColor}
          fallbackPixelSize={reg.fallbackPixelSize}
          iconScale={reg.iconScale}
          layerName={reg.key}
          disableRotation={reg.disableRotation}
        />
      ))}
    </>
  )
}
