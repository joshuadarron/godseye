import { useMemo, useRef } from 'react'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'
import type { LayerRegistration } from '../../registries/layerRegistry'

interface Props {
  registration: LayerRegistration
}

export default function GenericEntityLayer({ registration: reg }: Props) {
  const visible = useLayerVisibilityStore((s) => s.layers[reg.key])

  if (!visible) return null

  // Defer to custom layer component if provided (e.g. satellite propagation layer).
  if (reg.customLayer) {
    const CustomLayer = reg.customLayer
    return <CustomLayer registration={reg} />
  }

  return <DefaultEntityLayer registration={reg} />
}

function DefaultEntityLayer({ registration: reg }: Props) {
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[reg.key])
  const entities = reg.store((s) => s.entities)
  const version = reg.store((s) => s.version)

  const hasSubtypes = !!(reg.subtypes && reg.classifySubtype)

  // Cache converted ModelEntity results to avoid re-converting unchanged entities.
  const modelCacheRef = useRef(new Map<string, { entity: unknown; model: ModelEntity }>())

  const getOrConvert = (id: string, entity: unknown): ModelEntity => {
    const cached = modelCacheRef.current.get(id)
    if (cached && cached.entity === entity) {
      return cached.model
    }
    const model = reg.toModelEntity(entity as any)
    modelCacheRef.current.set(id, { entity, model })
    return model
  }

  // Group entities by subtype (or single group if no subtypes).
  const grouped = useMemo(() => {
    // Clean stale cache entries.
    for (const key of modelCacheRef.current.keys()) {
      if (!entities.has(key)) {
        modelCacheRef.current.delete(key)
      }
    }

    if (!hasSubtypes) {
      const map = new Map<string, ModelEntity>()
      entities.forEach((entity, id) => {
        map.set(id, getOrConvert(id, entity))
      })
      return new Map([['__default', map]])
    }

    const groups = new Map<string, Map<string, ModelEntity>>()
    entities.forEach((entity, id) => {
      const subtype = reg.classifySubtype!(entity)
      if (sublayerMap && !sublayerMap[subtype]) return

      if (!groups.has(subtype)) groups.set(subtype, new Map())
      groups.get(subtype)!.set(id, getOrConvert(id, entity))
    })
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, sublayerMap, hasSubtypes, reg])

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
