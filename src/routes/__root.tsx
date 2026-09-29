import { useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Nav } from "../components/Nav.js";
import { assetUrl } from "../lib/asset-url.js";
import "../styles/design-system.css";

function NotFound() {
  return (
    <div className="not-found">
      <h1>404 — Not Found</h1>
      <p className="text-muted">This page does not exist.</p>
    </div>
  );
}

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Usage Observatory" },
      { name: "theme-color", content: "#0c0e12" },
      { name: "color-scheme", content: "dark" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AI Observatory" },
      {
        name: "description",
        content: "Observability and cost analysis for AI usage across private applications.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      // Favicon: simplified silhouette (small sizes)
      { rel: "icon", href: assetUrl("favicon.ico"), sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: assetUrl("favicon-16x16.png") },
      { rel: "icon", type: "image/png", sizes: "32x32", href: assetUrl("favicon-32x32.png") },
      { rel: "icon", type: "image/png", sizes: "48x48", href: assetUrl("favicon-48x48.png") },
      // Apple / PWA
      { rel: "apple-touch-icon", href: assetUrl("apple-touch-icon.png"), sizes: "180x180" },
      { rel: "manifest", href: assetUrl("manifest.webmanifest") },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
  }));

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <div className="app-shell">
            <Nav />
            <main className="app-main">
              <Outlet />
            </main>
          </div>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
