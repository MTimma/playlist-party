import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { translations } from '../i18n/translations';
import type { Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'lv',
  setLanguage: () => {},
  t: (key: string) => key,
});

// Helper to get language from domain
const getDomainLanguage = (): Language | null => {
  const hostname = window.location.hostname;
  
  // Latvian domains
  if (hostname.endsWith('.lv') || hostname.includes('latvija')) {
    return 'lv';
  }
  
  // English domains
  if (hostname.endsWith('.com') || hostname.endsWith('.io') || 
      hostname.endsWith('.app') || hostname.endsWith('.dev') ||
      hostname.endsWith('.net') || hostname.endsWith('.org')) {
    return 'en';
  }
  
  // For localhost/IP/Firebase hosting, return null (use default)
  return null;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('lv');

  useEffect(() => {
    // Priority 1: Check URL parameter (highest priority - manual override)
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get('lang');
    
    if (langParam === 'en' || langParam === 'lv') {
      setLanguageState(langParam);
      localStorage.setItem('language', langParam);
      return;
    }
    
    // Priority 2: Check domain-based language
    const domainLang = getDomainLanguage();
    if (domainLang) {
      setLanguageState(domainLang);
      // Don't save to localStorage for domain-based (auto-detection)
      return;
    }
    
    // Priority 3: Check localStorage (saved preference)
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'lv') {
      setLanguageState(saved);
      return;
    }
    
    // Priority 4: Default fallback - Latvian
    setLanguageState('lv');
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    
    // Update URL parameter
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.pushState({}, '', url);
  };

  // Translation function with nested key support
  const t = (key: string): string => {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

