import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import he from "@/locales/he.json";
import en from "@/locales/en.json";

/*
  Lightweight i18n (Phase 8). Hebrew is default and RTL; English is LTR. The whole layout
  direction flips with the language, not just strings (brief §7).

  - t(key, vars?)  — chrome strings from he.json / en.json (dot-path), {var} interpolation.
  - tl({he,en})    — pick the right side of an inline bilingual label (used by the enum label
                     maps in labels.ts so those don't need to be duplicated into JSON).

  Document data (counterparty names, file names, free text) is shown as-is, never translated.
*/

export type Lang = "he" | "en";
const DICTS: Record<Lang, unknown> = { he, en };
const STORAGE_KEY = "vmr.lang";

interface I18nContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tl: (label: { he: string; en: string }) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function lookup(dict: unknown, key: string): string | undefined {
  const val = key.split(".").reduce<unknown>((o, k) => {
    if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, dict);
  return typeof val === "string" ? val : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "he" ? stored : "he";
  });
  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((l) => (l === "he" ? "en" : "he")), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key) ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      }
      return s;
    },
    [lang],
  );

  const tl = useCallback(
    (label: { he: string; en: string }) => (lang === "he" ? label.he : label.en),
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir, setLang, toggle, t, tl }),
    [lang, dir, setLang, toggle, t, tl],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
