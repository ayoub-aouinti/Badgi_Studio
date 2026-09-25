import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../state/kiosk-context';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ExampleCard } from '../components/ExampleCard';
import { SponsorBadge } from '../components/SponsorBadge';
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
        <p className="text-sm font-bold uppercase tracking-wide text-teal">{state.config?.eventName}</p>
        <h1 className="text-[2.4rem] font-extrabold leading-tight text-ink">{t('home.title')}</h1>

        <div className="flex w-full gap-3">
          <ExampleCard label={t('home.example1')} toneLight="#DDE5EE" toneDark="#2D4A6B" />
          <ExampleCard label={t('home.example2')} toneLight="#F8DDD3" toneDark="#9A3B20" />
          <ExampleCard label={t('home.example3')} toneLight="#E9DCC2" toneDark="#2C6FB0" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Button onClick={() => navigate('/identify')}>{t('home.start')}</Button>
        <SponsorBadge sponsorName={state.config?.sponsorName} sponsorLogoUrl={state.config?.sponsorLogoUrl} />
      </div>
    </div>
  );
}
