import { useTranslation } from 'react-i18next';
import { setKioskLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

const LABELS: Record<SupportedLanguage, string> = { fr: 'FR', en: 'EN', ar: 'ع' };

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-2">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          onClick={() => setKioskLanguage(lang)}
          className={`flex h-11 min-w-[44px] items-center justify-center rounded-full border px-3 text-sm font-semibold transition ${
            i18n.language === lang
              ? 'border-teal bg-teal text-white'
              : 'border-border bg-white text-ink-soft'
          }`}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
