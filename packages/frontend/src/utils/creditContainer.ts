/**
 * The element Cesium renders its required provider credits into.
 *
 * Cesium creates its own credit container and positions it over the canvas.
 * Handing it ours instead lets the Sources control place those credits beside
 * the per-layer data attributions, in one place, styled like the rest of the
 * HUD. It replaces the previous `creditContainer.style.display = 'none'`,
 * which hid attributions the providers require.
 *
 * A module-level element, like `viewerRef.ts`'s viewer: the `<Viewer>`
 * `creditContainer` prop is read once at construction, so the element has to
 * exist before first render. A DOM node is safe to share this way in a manner
 * a promise is not — see the comment in `imageryLayer.ts`.
 */

export const creditContainer = document.createElement('div')
