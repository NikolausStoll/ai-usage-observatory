interface ModelLabelProps {
  model: string;
  provider: string;
  /** Interactive: stop click propagation when used inside a clickable row. */
  interactive?: boolean;
  onInteract?: (e: React.MouseEvent) => void;
}

/** Model as primary identifier; provider available via title (and optional click). */
export function ModelLabel({ model, provider, interactive, onInteract }: ModelLabelProps) {
  const className = `model-label mono${interactive ? " model-label--interactive" : ""}`;
  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        title={`Provider: ${provider}`}
        onClick={(e) => {
          e.stopPropagation();
          onInteract?.(e);
        }}
      >
        {model}
      </button>
    );
  }
  return (
    <span className={className} title={`Provider: ${provider}`}>
      {model}
    </span>
  );
}
