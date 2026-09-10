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

export const Route = createFileRoute("/applications/")({
  loader: () => fetchApplications(),
  component: ApplicationsPage,
});

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
      // silently ignore — could show error
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>Applications</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
          + New application
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Create application</h2>
          <form onSubmit={submitCreate}>
            <div className="field-row">
              <label>Application ID (stable, technical)</label>
              <input
                value={createId}
                onChange={(e) => setCreateId(e.target.value)}
                placeholder="e.g. recipe-app"
                required
              />
            </div>
            <div className="field-row">
              <label>Display name</label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Recipe App"
                required
              />
            </div>
            {createError && <div className="error-box">{createError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary">Create</button>
              <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {newPlaintext && (
        <div className="card" style={{ borderColor: "#4caf50", background: "#0d1f0d", marginBottom: 16 }}>
          <div style={{ color: "#4caf50", fontWeight: "bold", marginBottom: 8 }}>
            ✓ API key created — copy it now, it will not be shown again
          </div>
          <code style={{
            display: "block",
            background: "#0a0a0a",
            padding: "10px 12px",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: "0.9em",
            wordBreak: "break-all",
            color: "#fff",
          }}>{newPlaintext}</code>
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => setNewPlaintext(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="text-muted">No applications yet.</div>
      ) : (
        apps.map((app) => (
          <div key={app.id} className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {editNameId === app.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); void submitEditName(app.id); }}
                    style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      autoFocus
                      required
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: "4px 10px" }}>Save</button>
                    <button type="button" className="btn" style={{ padding: "4px 10px" }} onClick={() => setEditNameId(null)}>Cancel</button>
                  </form>
                ) : (
                  <span style={{ fontSize: "1.05em", fontWeight: "bold" }}>{app.displayName}</span>
                )}
                <span style={{ color: "#666", fontFamily: "monospace", fontSize: "0.82em", marginLeft: 12 }}>{app.id}</span>
                <button
                  className="btn"
                  style={{ marginLeft: 8, padding: "2px 8px", fontSize: "0.78em" }}
                  onClick={() => { setEditNameId(app.id); setEditNameValue(app.displayName); }}
                >
                  Rename
                </button>
              </div>
              <button
                className="btn"
                onClick={() => toggleApp(app.id)}
              >
                {expandedApp === app.id ? "Hide keys ▲" : "API keys ▼"}
              </button>
            </div>
            <div style={{ color: "#666", fontSize: "0.82em", marginTop: 4 }}>
              Created {new Date(app.createdAt).toLocaleDateString()}
            </div>

            {expandedApp === app.id && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h2 style={{ margin: 0 }}>API Keys</h2>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "0.82em" }}
                    onClick={() => setNewKeyAppId(app.id)}
                  >
                    + New key
                  </button>
                </div>

                {newKeyAppId === app.id && (
                  <div style={{ background: "#1a1a1a", padding: 12, borderRadius: 4, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key name (e.g. production)"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={!newKeyName.trim()}
                        onClick={() => submitCreateKey(app.id)}
                      >
                        Create
                      </button>
                      <button className="btn" onClick={() => setNewKeyAppId(null)}>Cancel</button>
                    </div>
                    {keyError && <div className="error-box" style={{ marginTop: 8 }}>{keyError}</div>}
                  </div>
                )}

                {(keys[app.id] ?? []).length === 0 ? (
                  <div className="text-muted" style={{ fontSize: "0.9em" }}>No API keys.</div>
                ) : (
                  <table>
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
                      {(keys[app.id] ?? []).map((key) => (
                        <tr key={key.id}>
                          <td className="mono" style={{ fontSize: "0.9em" }}>{key.name}</td>
                          <td>
                            {key.revokedAt
                              ? <span style={{ color: "#f44336", fontSize: "0.85em" }}>Revoked {new Date(key.revokedAt).toLocaleDateString()}</span>
                              : <span style={{ color: "#4caf50", fontSize: "0.85em" }}>Active</span>}
                          </td>
                          <td style={{ fontSize: "0.85em", color: "#888" }}>
                            {new Date(key.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ fontSize: "0.85em", color: "#888" }}>
                            {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "—"}
                          </td>
                          <td>
                            {!key.revokedAt && (
                              <button
                                className="btn btn-danger"
                                style={{ fontSize: "0.78em", padding: "3px 8px" }}
                                onClick={() => handleRevoke(key.id, app.id)}
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
