import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import Sidebar from "@/components/Sidebar";
import { SettingsProvider } from "@/components/Settings";
import { api } from "@/lib/api";

import "./globals.css";

/**
 * Montserrat is Quimun's own typeface (quimun.com loads it) and carries the
 * brand here - wordmark and page titles only. Inter does the dense work:
 * tables, axis labels and anything with tabular figures, where Montserrat's
 * wide geometric forms would cost far too much horizontal space.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quimun · Inteligencia de portafolio",
  description:
    "Uso y engagement de las residencias que operan sobre Quimun. Usage and engagement across residences running on Quimun.",
};

// The snapshot is fixed, but triage state is mutable, so revalidate rather
// than freeze the shell at build time.
export const revalidate = 30;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The sidebar shows live counts. If the API is unreachable the shell must
  // still render - the page below will surface the real error.
  let counts = { residences: 0, signals: 0, attention: 0 };
  let asOf = "";
  try {
    const s = await api.summary();
    counts = {
      residences: s.residences,
      signals: s.signal_total,
      attention: s.attention_count,
    };
    asOf = s.as_of;
  } catch {
    /* handled by the page */
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Applied before paint so a reload never flashes the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('quimun.theme')||'light';if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}var l=localStorage.getItem('quimun.lang');if(l==='es'||l==='en'){document.documentElement.lang=l;}}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${montserrat.variable}`}>
        <SettingsProvider>
          <div className="shell">
            <Sidebar counts={counts} asOf={asOf} />
            <div className="main">{children}</div>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
