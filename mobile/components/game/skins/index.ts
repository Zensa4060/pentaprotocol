/**
 * Board/banner skin canvas API. Skins render the verbatim web `<canvas>`
 * animation through a transparent WebView ([CanvasWebView]); see [webCanvas.ts]
 * for the embedded web draw code and the gated rollout sets.
 */

export { CanvasWebView } from "./CanvasWebView";
export { bannerHtmlFor, buildSkinBgHtml, skinHasWebBg, type SkinBgGeom } from "./webCanvas";
