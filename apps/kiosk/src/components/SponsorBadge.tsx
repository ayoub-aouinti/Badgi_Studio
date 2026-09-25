import { useTranslation } from 'react-i18next';

interface SponsorBadgeProps {
  sponsorName?: string;
  sponsorLogoUrl?: string;
  dark?: boolean;
}

export function SponsorBadge({ sponsorName, sponsorLogoUrl, dark }: SponsorBadgeProps) {
  const { t } = useTranslation();
  if (!sponsorName) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm ${
        dark ? 'bg-ink text-white/80' : 'bg-border-soft text-ink-soft'
      }`}
    >
      {sponsorLogoUrl && <img src={sponsorLogoUrl} alt={sponsorName} className="h-6 w-auto" />}
      <span>{t('common.poweredBy', { sponsor: sponsorName })}</span>
    </div>
  );
}
