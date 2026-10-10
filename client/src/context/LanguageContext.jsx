import { createContext, useContext, useEffect, useState } from 'react';
import translations, { LANGUAGES } from '../services/translations.js';

const LanguageContext = createContext(null);
const LANG_KEY = 'khata_lang';

function loadLang() {
  const saved = localStorage.getItem(LANG_KEY);
  return LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(loadLang);

  const setLang = (code) => {
    localStorage.setItem(LANG_KEY, code);
    setLangState(code);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // t('key') gives the text in the current language (falls back to English)
  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}