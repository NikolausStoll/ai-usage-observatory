import { formatByteSize } from "../lib/format-bytes.js";
import { isArtifactDeleted, type ArtifactRecord } from "../domain/artifacts/artifact-schema.js";
import { fetchArtifactData, deleteArtifactFn } from "../server-functions/artifacts.js";
import { Badge } from "./ui/Badge.js";
import { useState } from "react";

interface ArtifactViewerProps {
  artifact: ArtifactRecord;
  onDeleted?: (artifact: ArtifactRecord) => void;
}

export function ArtifactViewer({ artifact, onDeleted }: ArtifactViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = isArtifactDeleted(artifact);

  const isImage = artifact.mimeType.startsWith("image/");
  const sizeLabel = formatByteSize(artifact.byteSize);

  async function loadData() {
    if (deleted) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArtifactData({ data: artifact.artifactId });
      if (!result) {
        setError("Not found");
        return;
      }
      if (result.deleted) {
        setError("Artifact was deleted");
        return;
      }
      setData({ dataBase64: result.dataBase64, mimeType: result.mimeType });
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (deleted || deleting) return;
    const name = artifact.label ?? artifact.originalFilename ?? artifact.artifactId.slice(0, 8);
    if (!window.confirm(`Delete artifact “${name}”? The binary will be removed; metadata stays as deleted.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const updated = await deleteArtifactFn({ data: artifact.artifactId });
      if (updated) onDeleted?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`artifact${deleted ? " artifact--deleted" : ""}`}>
      <div className="artifact__header">
        <div className="artifact__meta">
          <div className="artifact__title">
            <Badge variant="accent">{artifact.role}</Badge>
            {deleted ? <Badge variant="neutral">Deleted</Badge> : null}
            {artifact.label ? (
              <span className="text-secondary">{artifact.label}</span>
            ) : artifact.originalFilename ? (
              <span className="text-muted">{artifact.originalFilename}</span>
            ) : null}
          </div>
          <div className="artifact__details text-sm text-muted">
            <div>
              <span className="artifact__size num" title={`${artifact.byteSize.toLocaleString()} bytes`}>
                {sizeLabel}
              </span>
              <span className="event-card__sep"> · </span>
              <span>{artifact.mimeType}</span>
            </div>
            {artifact.width && artifact.height ? (
              <div>
                {artifact.width} × {artifact.height} px
              </div>
            ) : null}
            {deleted && artifact.deletedAt ? (
              <div>Deleted {new Date(artifact.deletedAt).toLocaleString("de-DE")}</div>
            ) : (
              <div className="mono" style={{ marginTop: 4 }}>
                SHA256: {artifact.contentHash.slice(0, 16)}…
              </div>
            )}
          </div>
        </div>
        <div className="artifact__actions">
          {!deleted && !loaded ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? "Loading…" : isImage ? "View image" : "Load data"}
            </button>
          ) : null}
          {!deleted ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
          {error ? <div className="text-error text-sm">{error}</div> : null}
        </div>
      </div>

      {loaded && data && isImage ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <img
            src={`data:${data.mimeType};base64,${data.dataBase64}`}
            alt={artifact.label ?? artifact.originalFilename ?? "artifact"}
            className="artifact__img"
          />
        </div>
      ) : null}

      {loaded && data && !isImage ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <a
            href={`data:${data.mimeType};base64,${data.dataBase64}`}
            download={artifact.originalFilename ?? `artifact-${artifact.artifactId}`}
            className="text-sm"
          >
            Download {artifact.originalFilename ?? "file"}
          </a>
        </div>
      ) : null}
    </div>
  );
}
