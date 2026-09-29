import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text used for filtering (in addition to label/value). */
  keywords?: string;
}

interface SearchableSelectProps {
  id: string;
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
}

function matchesQuery(option: SearchableSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${option.label} ${option.value} ${option.keywords ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

/** Compact combobox: type to filter options, pick one value (or All). */
export function SearchableSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Search…",
  allLabel = "All",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    return options.filter((o) => matchesQuery(o, query));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPanel() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  const display = open ? query : selected?.label ?? "";

  return (
    <div className={`filter-bar__field${className ? ` ${className}` : ""}`} ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <div className={`search-select${open ? " search-select--open" : ""}`}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={display}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={openPanel}
          onClick={openPanel}
          autoComplete="off"
        />
        {value && !open ? (
          <button
            type="button"
            className="search-select__clear"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              choose("");
            }}
          >
            ×
          </button>
        ) : (
          <span className="search-select__chevron" aria-hidden>
            ▾
          </span>
        )}
        {open ? (
          <ul id={listId} className="search-select__list" role="listbox">
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`search-select__option${!value ? " search-select__option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose("")}
              >
                {allLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="search-select__empty" role="presentation">
                No matches
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    className={`search-select__option${
                      opt.value === value ? " search-select__option--active" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Encode feature+operation for select values. */
export function encodeFeatureOp(feature: string, operation: string): string {
  return `${encodeURIComponent(feature)}::${encodeURIComponent(operation)}`;
}

export function decodeFeatureOp(
  value: string
): { feature: string; operation: string } | null {
  const idx = value.indexOf("::");
  if (idx < 0) return null;
  try {
    return {
      feature: decodeURIComponent(value.slice(0, idx)),
      operation: decodeURIComponent(value.slice(idx + 2)),
    };
  } catch {
    return null;
  }
}
