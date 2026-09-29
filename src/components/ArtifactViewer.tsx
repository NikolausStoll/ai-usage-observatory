import { useState } from "react";
import type { ArtifactRecord } from "../domain/artifacts/artifact-schema.js";
import { fetchArtifactData } from "../server-functions/artifacts.js";
import { Badge } from "./ui/Badge.js";

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
    <div className="artifact">
      <div className="row row--between" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            <Badge variant="accent">{artifact.role}</Badge>
            {" "}
            {artifact.label && <span className="text-secondary">{artifact.label}</span>}
            {!artifact.label && artifact.originalFilename && (
              <span className="text-muted">{artifact.originalFilename}</span>
            )}
          </div>
          <div className="text-sm text-muted">
            <div>{artifact.mimeType} · {(artifact.byteSize / 1024).toFixed(1)} KB</div>
            {artifact.width && artifact.height && (
              <div>{artifact.width} × {artifact.height} px</div>
            )}
            <div className="mono" style={{ marginTop: 4 }}>
              SHA256: {artifact.contentHash.slice(0, 16)}…
            </div>
          </div>
        </div>
        <div>
          {!loaded && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? "Loading…" : isImage ? "View image" : "Load data"}
            </button>
          )}
          {error && <div className="text-error text-sm">{error}</div>}
        </div>
      </div>

      {loaded && data && isImage && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <img
            src={`data:${data.mimeType};base64,${data.dataBase64}`}
            alt={artifact.label ?? artifact.originalFilename ?? "artifact"}
            className="artifact__img"
          />
        </div>
      )}

      {loaded && data && !isImage && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <a
            href={`data:${data.mimeType};base64,${data.dataBase64}`}
            download={artifact.originalFilename ?? `artifact-${artifact.artifactId}`}
            className="text-sm"
          >
            Download {artifact.originalFilename ?? "file"}
          </a>
        </div>
      )}
    </div>
  );
}
