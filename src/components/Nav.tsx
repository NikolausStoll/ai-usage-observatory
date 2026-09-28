import { Link } from "@tanstack/react-router";

export function Nav() {
  return (
    <nav style={{
      background: "#111",
      borderBottom: "1px solid #333",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      gap: 0,
      height: 48,
    }}>
      <Link
        to="/"
        style={{ color: "#e0e0e0", textDecoration: "none", fontWeight: "bold", marginRight: 32, fontSize: "1em" }}
      >
        AI Observatory
      </Link>
      {(["events", "applications", "pricing"] as const).map((path) => (
        <Link
          key={path}
          to={`/${path}`}
          style={{ color: "#aaa", textDecoration: "none", padding: "0 16px", height: "100%", display: "flex", alignItems: "center", fontSize: "0.9em", textTransform: "capitalize" }}
          activeProps={{ style: { color: "#fff", borderBottom: "2px solid #64b5f6" } }}
        >
          {path}
        </Link>
      ))}
    </nav>
  );
}
