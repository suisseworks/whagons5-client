import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from "@/config/languages";
import { esTranslations } from "@/locales/es";

type TranslationDictionary = Record<string, string>;

const TRANSLATION_REGISTRY: Record<string, TranslationDictionary> = {
  es: esTranslations,
  "es-ES": esTranslations,
};

const STORAGE_KEY = "whagons-preferred-language";

type LanguageContextValue = {
  language: string;
  setLanguage: (language: string) => void;
  translate: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const normalizeLanguage = (value?: string | null): string => {
  if (!value) return DEFAULT_LANGUAGE;
  if (LANGUAGE_OPTIONS.some((option) => option.value === value)) {
    return value;
  }
  const shortCode = value.split("-")[0];
  const matchingOption = LANGUAGE_OPTIONS.find((option) => option.value.startsWith(shortCode));
  if (matchingOption) {
    return matchingOption.value;
  }
  if (TRANSLATION_REGISTRY[value]) {
    return value;
  }
  if (TRANSLATION_REGISTRY[shortCode]) {
    return shortCode;
  }
  return DEFAULT_LANGUAGE;
};

const getInitialLanguage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return normalizeLanguage(stored);
  }
  return normalizeLanguage(navigator.language);
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<string>(() => getInitialLanguage());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const translate = useCallback(
    (key: string, fallback?: string) => {
      const dictionary =
        TRANSLATION_REGISTRY[language] ?? TRANSLATION_REGISTRY[language.split("-")[0]] ?? {};
      return dictionary[key] ?? fallback ?? key;
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      translate,
    }),
    [language, translate]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return {
    language: context.language,
    setLanguage: context.setLanguage,
    t: context.translate,
  };
};


