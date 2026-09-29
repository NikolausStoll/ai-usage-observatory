import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  fetchApplications,
  fetchApiKeys,
  createApplicationFn,
  updateApplicationDisplayNameFn,
  createApiKeyFn,
  revokeApiKeyFn,
} from "../../server-functions/applications.js";
import type { Application, ApiKey } from "../../domain/applications/application-service.js";
import { formatDateDe, formatDateTimeDe, formatDateTimeShortDe } from "../../lib/format-date.js";
import { PageHeader } from "../../components/ui/PageHeader.js";
import { SectionHeader } from "../../components/ui/SectionHeader.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { Badge } from "../../components/ui/Badge.js";

export const Route = createFileRoute("/applications/")({
  loader: () => fetchApplications(),
  component: ApplicationsPage,
});

function KeyStatus({ keyRecord }: { keyRecord: ApiKey }) {
  if (keyRecord.revokedAt) {
    return (
      <Badge variant="danger" title={`Revoked ${formatDateDe(keyRecord.revokedAt)}`}>
        Revoked
      </Badge>
    );
  }
  return <Badge variant="success">Active</Badge>;
}

function ApiKeyList({
  appId,
  keys,
  onRevoke,
}: {
  appId: string;
  keys: ApiKey[];
  onRevoke: (keyId: string, appId: string) => void;
}) {
  if (keys.length === 0) {
    return <EmptyState inline>No API keys.</EmptyState>;
  }

  return (
    <>
      <div className="keys-desktop table-wrap">
        <table className="keys-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last used</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="mono">{key.name}</td>
                <td><KeyStatus keyRecord={key} /></td>
                <td className="text-sm text-muted">{formatDateDe(key.createdAt)}</td>
                <td className="text-sm" title={key.lastUsedAt ? formatDateTimeDe(key.lastUsedAt) : undefined}>
                  {key.lastUsedAt ? formatDateTimeShortDe(key.lastUsedAt) : <span className="text-muted">Never</span>}
                </td>
                <td className="keys-table__actions">
                  {!key.revokedAt && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => onRevoke(key.id, appId)}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="keys-mobile">
        {keys.map((key) => (
          <div key={key.id} className="key-card">
            <div className="key-card__top">
              <span className="key-card__name mono">{key.name}</span>
              <KeyStatus keyRecord={key} />
            </div>
            <div className="key-card__meta">
              <div>
                <span className="key-card__label">Created</span>
                <span>{formatDateDe(key.createdAt)}</span>
              </div>
              <div>
                <span className="key-card__label">Last used</span>
                <span title={key.lastUsedAt ? formatDateTimeDe(key.lastUsedAt) : undefined}>
                  {key.lastUsedAt ? formatDateTimeShortDe(key.lastUsedAt) : "Never"}
                </span>
              </div>
            </div>
            {!key.revokedAt && (
              <div className="key-card__actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => onRevoke(key.id, appId)}
                >
                  Revoke
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ApplicationsPage() {
  const apps: Application[] = Route.useLoaderData();
  const router = useRouter();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createId, setCreateId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, ApiKey[]>>({});
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null);
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyAppId, setNewKeyAppId] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  async function loadKeys(appId: string) {
    const loaded = await fetchApiKeys({ data: appId });
    setKeys((prev) => ({ ...prev, [appId]: loaded }));
  }

  async function toggleApp(appId: string) {
    if (expandedApp === appId) {
      setExpandedApp(null);
      return;
    }
    setExpandedApp(appId);
    await loadKeys(appId);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createApplicationFn({ data: { id: createId.trim(), displayName: createName.trim() } });
      setCreateId("");
      setCreateName("");
      setShowCreateForm(false);
      void router.invalidate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  async function submitEditName(appId: string) {
    try {
      await updateApplicationDisplayNameFn({ data: { id: appId, displayName: editNameValue.trim() } });
      setEditNameId(null);
      void router.invalidate();
    } catch {
      // silently ignore
    }
  }

  async function submitCreateKey(appId: string) {
    setKeyError(null);
    try {
      const result = await createApiKeyFn({ data: { applicationId: appId, name: newKeyName.trim() } });
      setNewPlaintext(result.plaintext);
      setNewKeyName("");
      setNewKeyAppId(null);
      await loadKeys(appId);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Failed to create key");
    }
  }

  async function handleRevoke(keyId: string, appId: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await revokeApiKeyFn({ data: keyId });
    await loadKeys(appId);
  }

  return (
    <div className="page">
      <PageHeader
        title="Applications"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            + New application
          </button>
        }
      />

      {showCreateForm && (
        <div className="card admin-panel">
          <h2 className="section-title">Create application</h2>
          <form onSubmit={submitCreate}>
            <div className="field-row">
              <label>Display name</label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Recipe App"
                required
              />
            </div>
            <div className="field-row">
              <label>Application ID (stable, technical)</label>
              <input
                value={createId}
                onChange={(e) => setCreateId(e.target.value)}
                placeholder="e.g. recipe-app"
                className="mono"
                required
              />
            </div>
            {createError && <div className="error-box">{createError}</div>}
            <div className="cluster">
              <button type="submit" className="btn btn-primary">Create</button>
              <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {newPlaintext && (
        <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>
          <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
            ✓ API key created — copy it now, it will not be shown again
          </div>
          <code className="code-inline">{newPlaintext}</code>
          <button
            type="button"
            className="btn"
            style={{ marginTop: "var(--space-2)" }}
            onClick={() => setNewPlaintext(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <EmptyState inline>No applications yet.</EmptyState>
      ) : (
        <div className="app-list">
          {apps.map((app) => {
            const expanded = expandedApp === app.id;
            return (
              <div key={app.id} className={`app-item${expanded ? " app-item--expanded" : ""}`}>
                <div className="app-item__header">
                  <div className="app-item__identity">
                    {editNameId === app.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); void submitEditName(app.id); }}
                        className="cluster"
                      >
                        <input
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          autoFocus
                          required
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        <button type="button" className="btn btn-sm" onClick={() => setEditNameId(null)}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <div className="app-item__name">{app.displayName}</div>
                        <div className="app-item__id mono">{app.id}</div>
                      </>
                    )}
                    <div className="app-item__created text-muted">
                      Created {formatDateDe(app.createdAt)}
                    </div>
                  </div>
                  <div className="app-item__actions">
                    {editNameId !== app.id && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditNameId(app.id); setEditNameValue(app.displayName); }}
                      >
                        Rename
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => toggleApp(app.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? "Hide keys" : "API keys"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="app-item__keys">
                    <SectionHeader
                      title="API Keys"
                      actions={
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setNewKeyAppId(app.id)}
                        >
                          + New key
                        </button>
                      }
                    />

                    {newKeyAppId === app.id && (
                      <div className="surface" style={{ marginBottom: "var(--space-3)" }}>
                        <div className="cluster key-create">
                          <input
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="Key name (e.g. production)"
                            className="key-create__input"
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!newKeyName.trim()}
                            onClick={() => submitCreateKey(app.id)}
                          >
                            Create
                          </button>
                          <button type="button" className="btn" onClick={() => setNewKeyAppId(null)}>Cancel</button>
                        </div>
                        {keyError && <div className="error-box" style={{ marginTop: "var(--space-2)" }}>{keyError}</div>}
                      </div>
                    )}

                    <ApiKeyList
                      appId={app.id}
                      keys={keys[app.id] ?? []}
                      onRevoke={handleRevoke}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
