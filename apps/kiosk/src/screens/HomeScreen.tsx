import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Laugh, Pencil, UserRound } from 'lucide-react';
import { useKiosk } from '../state/kiosk-context';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ExampleCard } from '../components/ExampleCard';
import { Button } from '../components/Button';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useKiosk();

  return (
    <div className="kiosk-shell justify-between">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-teal">{state.config?.branding.eventName}</p>
        {state.config?.branding.tagline && <p className="-mt-4 text-ink-soft">{state.config.branding.tagline}</p>}
        <h1 className="text-[2.4rem] font-extrabold leading-tight text-ink">{t('home.title')}</h1>

        <div className="flex w-full gap-3">
          <ExampleCard label={t('home.example1')} toneLight="#DDE5EE" toneDark="#2D4A6B" icon={UserRound} />
          <ExampleCard label={t('home.example2')} toneLight="#F8DDD3" toneDark="#9A3B20" icon={Laugh} />
          <ExampleCard label={t('home.example3')} toneLight="#E4E4E4" toneDark="#1F1F1F" icon={Pencil} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Button onClick={() => navigate('/entry')}>{t('home.start')}</Button>
      </div>
    </div>
  );
}
