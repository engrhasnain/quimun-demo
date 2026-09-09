"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSettings } from "@/components/Settings";
import { Icon } from "@/components/ui";
import { longDate } from "@/lib/format";

export default function Sidebar({
  counts,
  asOf,
}: {
  counts: { residences: number; signals: number; attention: number };
  asOf: string;
}) {
  const path = usePathname();
  const { t, lang, setLang, theme, setTheme } = useSettings();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const main = [
    { href: "/", icon: "portfolio", label: t.nav.overview },
    { href: "/residencias", icon: "residences", label: t.nav.residences, count: counts.residences },
    { href: "/senales", icon: "signals", label: t.nav.signals, count: counts.signals },
  ];
  const analysis = [
    { href: "/modulos", icon: "modules", label: t.nav.modules },
    { href: "/modelo", icon: "model", label: t.nav.model },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <Link href="/" className="wordmark" aria-label="Quimun">
          <span className="wordmark-glyph" aria-hidden>
            Q
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="wordmark-text">Quimun</span>
            <span className="wordmark-sub" style={{ display: "block" }}>
              {t.brandSub}
            </span>
          </span>
        </Link>
      </div>

      <nav className="nav">
        <div className="nav-group">
          <div className="nav-group-label">{t.nav.sectionMain}</div>
          {main.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span className="truncate">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="nav-count num">{item.count}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-label">{t.nav.sectionAnalysis}</div>
          {analysis.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="sidebar-foot">
        {asOf && (
          <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
            {t.common.lastUpdated} {longDate(asOf, lang)}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="seg" role="group" aria-label={t.common.language}>
            <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>
              ES
            </button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              EN
            </button>
          </div>

          <div className="seg" role="group" aria-label={t.common.theme}>
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
              title={t.common.light}
            >
              <Icon name="sun" size={13} />
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
              title={t.common.dark}
            >
              <Icon name="moon" size={13} />
            </button>
            <button
              type="button"
              aria-pressed={theme === "system"}
              onClick={() => setTheme("system")}
              title={t.common.system}
              style={{ fontSize: 10.5, fontWeight: 600 }}
            >
              {lang === "es" ? "AUTO" : "AUTO"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
