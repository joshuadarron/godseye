import { Color, Material } from 'cesium'

export const ANIMATED_DASH_TYPE = 'AnimatedDash'

const ANIMATED_DASH_SOURCE = `
uniform vec4 color;
uniform float dashLength;
uniform float speed;

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  float t = float(czm_frameNumber) * speed;
  float pos = materialInput.st.s / dashLength - t;
  float pattern = step(0.5, fract(pos));
  material.diffuse = color.rgb;
  material.alpha = color.a * pattern;
  return material;
}
`

let registered = false

export function ensureAnimatedDashMaterial() {
  if (registered) return
  registered = true
  ;(Material as any)._materialCache.addMaterial(ANIMATED_DASH_TYPE, {
    fabric: {
      type: ANIMATED_DASH_TYPE,
      uniforms: {
        color: new Color(0, 1, 1, 0.6),
        dashLength: 0.006,
        speed: 0.005,
      },
      source: ANIMATED_DASH_SOURCE,
    },
    translucent: true,
  })
}
