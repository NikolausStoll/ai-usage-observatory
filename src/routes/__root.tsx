import { useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Nav } from "../components/Nav.js";

function NotFound() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ color: "#f44336" }}>404 — Not Found</h1>
      <p style={{ color: "#888" }}>This page does not exist.</p>
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
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; background: #0d0d0d; color: #e0e0e0; font-family: system-ui, -apple-system, sans-serif; }
          a { color: #64b5f6; }
          button { cursor: pointer; }
          input, select, textarea {
            background: #1a1a1a; color: #e0e0e0; border: 1px solid #444;
            padding: 6px 10px; border-radius: 4px; font-size: 0.9em;
          }
          input:focus, select:focus, textarea:focus { outline: 1px solid #64b5f6; border-color: #64b5f6; }
          table { border-collapse: collapse; width: 100%; }
          th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #222; font-size: 0.88em; }
          th { color: #888; font-weight: 600; font-size: 0.8em; text-transform: uppercase; }
          tr:hover td { background: #141414; }
          .page { padding: 24px; max-width: 1400px; }
          .section { margin-bottom: 32px; }
          h1 { font-size: 1.4em; margin: 0 0 16px 0; color: #fff; }
          h2 { font-size: 1.1em; margin: 0 0 12px 0; color: #ccc; }
          .btn {
            padding: 6px 14px; border-radius: 4px; border: 1px solid #555;
            background: #1a1a1a; color: #e0e0e0; font-size: 0.85em;
          }
          .btn:hover { background: #252525; border-color: #777; }
          .btn-primary { background: #1a2a3a; color: #64b5f6; border-color: #64b5f6; }
          .btn-primary:hover { background: #1e3248; }
          .btn-danger { background: #2a1a1a; color: #f44336; border-color: #f44336; }
          .field-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
          .field-row label { font-size: 0.82em; color: #888; }
          .field-row input, .field-row select, .field-row textarea { max-width: 400px; }
          .card { background: #161616; border: 1px solid #2a2a2a; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .stat-card { background: #161616; border: 1px solid #2a2a2a; border-radius: 6px; padding: 20px; }
          .stat-value { font-size: 2em; font-weight: bold; color: #64b5f6; font-family: monospace; }
          .stat-label { color: #888; font-size: 0.85em; margin-top: 4px; }
          .mono { font-family: monospace; }
          .text-muted { color: #888; }
          .text-warn { color: #ff9800; }
          .text-error { color: #f44336; }
          .text-success { color: #4caf50; }
          .error-box { background: #2a1a1a; border: 1px solid #f44336; border-radius: 4px; padding: 12px; color: #f44336; margin: 8px 0; }
          .success-box { background: #1a2a1a; border: 1px solid #4caf50; border-radius: 4px; padding: 12px; color: #4caf50; margin: 8px 0; }
        `}</style>
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Nav />
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
