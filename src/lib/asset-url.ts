import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Asset base path that works both at `/` and under Home Assistant Ingress
 * (`/api/hassio_ingress/<token>/`). Trailing slash included.
 *
 * Manifest icon `src` values stay relative (no leading `/`) so they resolve
 * from the manifest URL under Ingress without rewriting.
 */
export const getAssetBase = createIsomorphicFn()
  .server(() => {
    const ingress =
      getRequestHeader("x-ingress-path") ??
      getRequestHeader("X-Ingress-Path");
    if (ingress && ingress.length > 0) {
      return ingress.endsWith("/") ? ingress : `${ingress}/`;
    }
    return "/";
  })
  .client(() => {
    const match = window.location.pathname.match(
      /^(\/api\/hassio_ingress\/[^/]+)/
    );
    if (match?.[1]) return `${match[1]}/`;
    return "/";
  });

/** Resolve a public-asset path for head links (ingress-safe). */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, "");
  return `${getAssetBase()}${clean}`;
}
