import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const RTL_LANGUAGES = ['ar'];
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'badgi-kiosk-lang';

function storedLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(stored ?? '')
    ? (stored as SupportedLanguage)
    : 'fr';
}

export function applyDocumentDirection(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

export function setKioskLanguage(language: SupportedLanguage) {
  localStorage.setItem(STORAGE_KEY, language);
  void i18n.changeLanguage(language);
  applyDocumentDirection(language);
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: storedLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

applyDocumentDirection(i18n.language);

export default i18n;
