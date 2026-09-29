import { formatByteSize } from "../lib/format-bytes.js";
import { isArtifactDeleted, type ArtifactRecord } from "../domain/artifacts/artifact-schema.js";
import { fetchArtifactData, deleteArtifactFn } from "../server-functions/artifacts.js";
import { Badge } from "./ui/Badge.js";
import { useEffect, useId, useState } from "react";

interface ArtifactViewerProps {
  artifact: ArtifactRecord;
  onDeleted?: (artifact: ArtifactRecord) => void;
  /** Larger image preview for request inspector layouts. */
  size?: "default" | "large";
  /** Tighter layout for request inspector (less chrome). */
  compact?: boolean;
}

export function ArtifactViewer({
  artifact,
  onDeleted,
  size = "default",
  compact = false,
}: ArtifactViewerProps) {
  const overlayTitleId = useId();
  const [data, setData] = useState<{ dataBase64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const deleted = isArtifactDeleted(artifact);

  const isImage = artifact.mimeType.startsWith("image/");
  const sizeLabel = formatByteSize(artifact.byteSize);
  const alt = artifact.label ?? artifact.originalFilename ?? "artifact";
  const src = data ? `data:${data.mimeType};base64,${data.dataBase64}` : null;

  useEffect(() => {
    if (deleted || !isImage) return;
    let cancelled = false;

    async function loadImage() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchArtifactData({ data: artifact.artifactId });
        if (cancelled) return;
        if (!result) {
          setError("Not found");
          return;
        }
        if (result.deleted) {
          setError("Artifact was deleted");
          return;
        }
        setData({ dataBase64: result.dataBase64, mimeType: result.mimeType });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadImage();
    return () => {
      cancelled = true;
    };
  }, [artifact.artifactId, deleted, isImage]);

  useEffect(() => {
    if (!overlayOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOverlayOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [overlayOpen]);

  async function loadNonImage() {
    if (deleted || isImage) return;
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
    setOverlayOpen(false);
    try {
      const updated = await deleteArtifactFn({ data: artifact.artifactId });
      if (updated) onDeleted?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const thumbClass = compact
    ? "artifact__thumb artifact__thumb--compact"
    : size === "large"
      ? "artifact__thumb artifact__thumb--large"
      : "artifact__thumb";

  const rootClass = [
    "artifact",
    deleted ? "artifact--deleted" : "",
    size === "large" && !compact ? "artifact--large" : "",
    compact ? "artifact--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <div
        className={`artifact__body${(size === "large" || compact) && isImage ? " artifact__body--stack" : ""}`}
      >
        {isImage && !deleted ? (
          <div className="artifact__thumb-wrap">
            {src ? (
              <button
                type="button"
                className="artifact__thumb-btn"
                onClick={() => setOverlayOpen(true)}
                aria-label={`Enlarge ${alt}`}
              >
                <img src={src} alt={alt} className={thumbClass} />
              </button>
            ) : (
              <div className={`${thumbClass} artifact__thumb--placeholder`} aria-hidden>
                {loading ? "…" : "—"}
              </div>
            )}
          </div>
        ) : null}

        <div className="artifact__main">
          <div className="artifact__header">
            <div className="artifact__meta">
              {compact ? (
                <div className="artifact__meta-line text-xs text-muted">
                  <Badge variant="accent">{artifact.role}</Badge>
                  {deleted ? <Badge variant="neutral">Deleted</Badge> : null}
                  {artifact.label ? (
                    <span className="text-secondary">{artifact.label}</span>
                  ) : artifact.originalFilename ? (
                    <span>{artifact.originalFilename}</span>
                  ) : null}
                  <span className="event-card__sep"> · </span>
                  <span>{artifact.mimeType}</span>
                  <span className="event-card__sep"> · </span>
                  <span className="num" title={`${artifact.byteSize.toLocaleString()} bytes`}>
                    {sizeLabel}
                  </span>
                  {artifact.width && artifact.height ? (
                    <>
                      <span className="event-card__sep"> · </span>
                      <span>
                        {artifact.width}×{artifact.height}
                      </span>
                    </>
                  ) : null}
                  {!deleted ? (
                    <>
                      <span className="event-card__sep"> · </span>
                      <span className="mono">{artifact.contentHash.slice(0, 12)}…</span>
                    </>
                  ) : null}
                </div>
              ) : (
                <>
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
                      <span
                        className="artifact__size num"
                        title={`${artifact.byteSize.toLocaleString()} bytes`}
                      >
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
                </>
              )}
            </div>
            <div className="artifact__actions">
              {!deleted && !isImage && !data ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={loadNonImage}
                  disabled={loading}
                >
                  {loading ? "Loading…" : "Load data"}
                </button>
              ) : null}
              {!deleted ? (
                <button
                  type="button"
                  className={`btn btn-sm${compact ? " btn-ghost" : " btn-danger"}`}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              ) : null}
              {error ? <div className="text-error text-sm">{error}</div> : null}
            </div>
          </div>

          {!isImage && data ? (
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
      </div>

      {overlayOpen && src ? (
        <div
          className="artifact-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={overlayTitleId}
          onClick={() => setOverlayOpen(false)}
        >
          <div
            className="artifact-lightbox__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="artifact-lightbox__bar">
              <span id={overlayTitleId} className="artifact-lightbox__title">
                {alt}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOverlayOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <img src={src} alt={alt} className="artifact-lightbox__img" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
