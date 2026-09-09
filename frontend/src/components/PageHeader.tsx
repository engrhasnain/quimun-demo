"use client";

import type { ReactNode } from "react";

export default function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title brandface">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  );
}
