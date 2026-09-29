import { useEffect, useId, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { assetUrl } from "../lib/asset-url.js";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/events", label: "Events", exact: false },
  { to: "/applications", label: "Applications", exact: false },
  { to: "/pricing", label: "Pricing", exact: false },
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function isActive(to: string, exact: boolean) {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  function renderLinks(mobile: boolean) {
    return NAV_ITEMS.map(({ to, label, exact }) => {
      const active = isActive(to, exact);
      return (
        <Link
          key={to}
          to={to}
          className={`app-nav__link${active ? " app-nav__link--active" : ""}`}
          onClick={() => {
            if (mobile) setOpen(false);
          }}
        >
          {label}
        </Link>
      );
    });
  }

  return (
    <nav className={`app-nav${open ? " app-nav--open" : ""}`} aria-label="Primary">
      <div className="app-nav__inner">
        <div className="app-nav__bar">
          <Link to="/" className="app-nav__brand">
            <img
              src={assetUrl("favicon-32x32.png")}
              alt=""
              width={20}
              height={20}
              className="app-nav__brand-icon"
            />
            <span className="app-nav__brand-text">Observatory</span>
          </Link>
          <div className="app-nav__links app-nav__links--desktop">
            {renderLinks(false)}
          </div>
          <button
            type="button"
            className="app-nav__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="app-nav__toggle-icon" aria-hidden />
          </button>
        </div>
      </div>
      <div id={panelId} className="app-nav__mobile">
        {renderLinks(true)}
      </div>
    </nav>
  );
}
