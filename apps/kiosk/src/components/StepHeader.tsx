import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface StepHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

export function StepHeader({ current, total, onBack }: StepHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mb-8 flex items-center gap-4">
      <button
        aria-label={t('common.back')}
        onClick={onBack ?? (() => navigate(-1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white"
      >
        <ChevronLeft size={22} className="rtl-flip" />
      </button>
      <span className="text-sm font-semibold text-ink-soft">{t('common.step', { current, total })}</span>
    </div>
  );
}
