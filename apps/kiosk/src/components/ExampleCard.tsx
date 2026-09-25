import { useTranslation } from 'react-i18next';

interface ExampleCardProps {
  label: string;
  toneLight: string;
  toneDark: string;
}

export function ExampleCard({ label, toneLight, toneDark }: ExampleCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div
        className="flex h-[110px] w-full items-center justify-center rounded-2xl"
        style={{ backgroundColor: toneLight }}
      >
        <div className="h-10 w-10 rounded-full" style={{ backgroundColor: toneDark }} />
      </div>
      <p className="text-center text-xs font-semibold text-ink-soft">{label}</p>
      <span className="rounded-full bg-border-soft px-2 py-0.5 text-[10px] text-ink-soft-2">
        {t('common.fictionalExample')}
      </span>
    </div>
  );
}
