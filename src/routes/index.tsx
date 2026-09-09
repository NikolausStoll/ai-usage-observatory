import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>AI Usage Observatory</h1>
      <p>v0.1.0 — Phase 1</p>
    </div>
  );
}
