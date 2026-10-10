import { createContext, useContext, useState } from 'react';
import translations from '../i18n/translations.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('khata_lang') || 'en';
    } catch (err) {
      return 'en';
    }
  });

  const changeLang = (l) => {
    setLang(l);
    try {
      localStorage.setItem('khata_lang', l);
    } catch (err) {
      // ignore
    }
  };

  // Falls back to English, then to the key itself
  const t = (key) => (translations[lang] && translations[lang][key]) || translations.en[key] || key;

  return <LanguageContext.Provider value={{ lang, changeLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}