import { useMemo, useState, type ReactNode } from "react";

interface JsonDisplayProps {
  value: unknown;
  label?: string;
  /** Start collapsed when serialized length exceeds this (default 2400). */
  collapseAbove?: number;
  /** Initial max height in px when collapsed (default 280). */
  maxHeight?: number;
  /** Visually secondary (metadata / config). */
  secondary?: boolean;
  defaultExpanded?: boolean;
  /** Matched heights for Request/Response inspector panes. */
  inspectorRole?: "primary" | "secondary";
}

function serialize(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Lightweight JSON highlighter — no dependency. */
function highlightJson(text: string): ReactNode[] {
  const re =
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],])/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(
        <span key={key++} className="json-key">
          {match[1]}
        </span>
      );
      nodes.push(": ");
    } else if (match[2] !== undefined) {
      nodes.push(
        <span key={key++} className="json-string">
          {match[2]}
        </span>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <span key={key++} className="json-number">
          {match[3]}
        </span>
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <span key={key++} className="json-literal">
          {match[4]}
        </span>
      );
    } else {
      nodes.push(
        <span key={key++} className="json-punct">
          {match[0]}
        </span>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const INSPECTOR_HEIGHT = { primary: 280, secondary: 160 } as const;

export function JsonDisplay({
  value,
  label,
  collapseAbove = 2400,
  maxHeight: maxHeightProp,
  secondary = false,
  defaultExpanded = false,
  inspectorRole,
}: JsonDisplayProps) {
  const maxHeight =
    maxHeightProp ??
    (inspectorRole === "primary"
      ? INSPECTOR_HEIGHT.primary
      : inspectorRole === "secondary"
        ? INSPECTOR_HEIGHT.secondary
        : 280);
  const text = useMemo(() => serialize(value), [value]);
  const highlighted = useMemo(() => highlightJson(text), [text]);
  const isLarge = text.length > collapseAbove || text.split("\n").length > 24;
  const [expanded, setExpanded] = useState(defaultExpanded || !isLarge);
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined) {
    return (
      <div className={`json-panel${secondary ? " json-panel--secondary" : ""}`}>
        {label ? <div className="json-panel__label">{label}</div> : null}
        <span className="text-muted">—</span>
      </div>
    );
  }

  async function handleCopy() {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const inspectorClass =
    inspectorRole === "primary"
      ? " json-panel--inspector-primary"
      : inspectorRole === "secondary"
        ? " json-panel--inspector-secondary"
        : "";

  return (
    <div className={`json-panel${secondary ? " json-panel--secondary" : ""}${inspectorClass}`}>
      <div className="json-panel__bar">
        {label ? <div className="json-panel__label">{label}</div> : <span />}
        <div className="json-panel__actions">
          {isLarge ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleCopy()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre
        className={`code-block json-block${!expanded ? " json-block--collapsed" : ""}${inspectorRole && !expanded ? " json-block--inspector" : ""}`}
        style={!expanded ? { maxHeight } : undefined}
      >
        <code>{highlighted}</code>
      </pre>
      {!expanded && isLarge ? (
        <button
          type="button"
          className="json-panel__expand-hint"
          onClick={() => setExpanded(true)}
        >
          Show full value ({text.length.toLocaleString()} chars)
        </button>
      ) : null}
    </div>
  );
}
