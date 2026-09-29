import { useState } from "react";

interface CopyableValueProps {
  value: string;
  className?: string;
  /** Truncate long values for display; full value remains copyable. */
  truncate?: number;
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

export function CopyableValue({ value, className, truncate }: CopyableValueProps) {
  const [copied, setCopied] = useState(false);
  const display =
    truncate != null && value.length > truncate
      ? `${value.slice(0, truncate)}…`
      : value;

  async function handleCopy() {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className={`copyable${className ? ` ${className}` : ""}`}>
      <code className="copyable__value mono" title={value}>
        {display}
      </code>
      <button
        type="button"
        className="btn btn-ghost btn-sm copyable__btn"
        onClick={() => void handleCopy()}
        aria-label={copied ? "Copied" : "Copy"}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
