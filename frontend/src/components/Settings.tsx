"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dict, type Dict, type Lang } from "@/i18n/dictionary";

type Theme = "light" | "dark" | "system";

interface Settings {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: Dict;
}

const Ctx = createContext<Settings | null>(null);

const LANG_KEY = "quimun.lang";
const THEME_KEY = "quimun.theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Spanish first: the product, the company and its customers are Chilean.
  const [lang, setLangState] = useState<Lang>("es");
  // Light by default. "system" is still selectable, but a dark-by-accident
  // first impression was the single most common complaint.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      // ?lang=en wins over the stored preference, so a link can be shared in a
      // specific language without the recipient having to toggle.
      const fromUrl = new URLSearchParams(window.location.search).get("lang");
      if (fromUrl === "es" || fromUrl === "en") {
        setLangState(fromUrl);
        document.documentElement.lang = fromUrl;
        localStorage.setItem(LANG_KEY, fromUrl);
      } else {
        const l = localStorage.getItem(LANG_KEY);
        if (l === "es" || l === "en") setLangState(l);
      }
      const themeFromUrl = new URLSearchParams(window.location.search).get("theme");
      const th = themeFromUrl ?? localStorage.getItem(THEME_KEY) ?? "light";
      if (th === "light" || th === "dark" || th === "system") {
        setThemeState(th);
        applyTheme(th);
      }
    } catch {
      /* private mode, blocked storage - defaults are fine */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
    document.documentElement.lang = l;
  }, []);

  const setTheme = useCallback((th: Theme) => {
    setThemeState(th);
    applyTheme(th);
    try {
      localStorage.setItem(THEME_KEY, th);
    } catch {}
  }, []);

  const value = useMemo<Settings>(
    () => ({ lang, setLang, theme, setTheme, t: dict[lang] as Dict }),
    [lang, theme, setLang, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}

/** Convenience for the very common `const { t, lang } = ...` pair. */
export function useT() {
  const { t, lang } = useSettings();
  return { t, lang };
}
