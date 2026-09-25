import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ExampleCardProps {
  label: string;
  toneLight: string;
  toneDark: string;
  icon: LucideIcon;
}

export function ExampleCard({ label, toneLight, toneDark, icon: Icon }: ExampleCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div
        className="flex h-[110px] w-full items-center justify-center rounded-2xl"
        style={{ backgroundColor: toneLight }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/60"
          style={{ color: toneDark }}
        >
          <Icon size={30} strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-ink-soft">{label}</p>
      <span className="rounded-full bg-border-soft px-2 py-0.5 text-[10px] text-ink-soft-2">
        {t('common.fictionalExample')}
      </span>
    </div>
  );
}
