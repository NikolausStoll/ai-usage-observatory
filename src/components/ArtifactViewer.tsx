import { useState } from "react";
import type { ArtifactRecord } from "../domain/artifacts/artifact-schema.js";
import { fetchArtifactData } from "../server-functions/artifacts.js";

interface ArtifactViewerProps {
  artifact: ArtifactRecord;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = artifact.mimeType.startsWith("image/");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArtifactData({ data: artifact.artifactId });
      if (result) {
        setData({ dataBase64: result.dataBase64, mimeType: result.mimeType });
        setLoaded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      border: "1px solid #333",
      borderRadius: "4px",
      padding: "12px",
      marginBottom: "8px",
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>
            <span style={{
              background: "#1a2a3a",
              color: "#64b5f6",
              padding: "2px 6px",
              borderRadius: "3px",
              fontSize: "0.8em",
              marginRight: 8,
            }}>{artifact.role}</span>
            {artifact.label && <span style={{ color: "#ccc" }}>{artifact.label}</span>}
            {!artifact.label && artifact.originalFilename && (
              <span style={{ color: "#aaa" }}>{artifact.originalFilename}</span>
            )}
          </div>
          <div style={{ fontSize: "0.85em", color: "#888" }}>
            <div>{artifact.mimeType} · {(artifact.byteSize / 1024).toFixed(1)} KB</div>
            {artifact.width && artifact.height && (
              <div>{artifact.width} × {artifact.height} px</div>
            )}
            <div style={{ fontFamily: "monospace", fontSize: "0.9em", marginTop: 4 }}>
              SHA256: {artifact.contentHash.slice(0, 16)}…
            </div>
          </div>
        </div>
        <div>
          {!loaded && (
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                padding: "4px 12px",
                background: "#1a2a3a",
                color: "#64b5f6",
                border: "1px solid #64b5f6",
                borderRadius: "3px",
                cursor: loading ? "wait" : "pointer",
                fontSize: "0.85em",
              }}
            >
              {loading ? "Loading…" : isImage ? "View image" : "Load data"}
            </button>
          )}
          {error && <div style={{ color: "#f44336", fontSize: "0.85em" }}>{error}</div>}
        </div>
      </div>

      {loaded && data && isImage && (
        <div style={{ marginTop: 12 }}>
          <img
            src={`data:${data.mimeType};base64,${data.dataBase64}`}
            alt={artifact.label ?? artifact.originalFilename ?? "artifact"}
            style={{ maxWidth: "100%", maxHeight: "600px", border: "1px solid #444", borderRadius: "4px" }}
          />
        </div>
      )}

      {loaded && data && !isImage && (
        <div style={{ marginTop: 12 }}>
          <a
            href={`data:${data.mimeType};base64,${data.dataBase64}`}
            download={artifact.originalFilename ?? `artifact-${artifact.artifactId}`}
            style={{ color: "#64b5f6", fontSize: "0.85em" }}
          >
            Download {artifact.originalFilename ?? "file"}
          </a>
        </div>
      )}
    </div>
  );
}
