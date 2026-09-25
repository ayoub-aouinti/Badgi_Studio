import { Check } from 'lucide-react';
import type { KioskStyleDto } from '@badgi-studio/shared';

function toneFor(name: string): { light: string; dark: string } {
  const n = name.toLowerCase();
  if (n.includes('caricature')) return { light: '#F8DDD3', dark: '#9A3B20' };
  if (n.includes('peint')) return { light: '#E9DCC2', dark: '#2C6FB0' };
  return { light: '#DDE5EE', dark: '#2D4A6B' };
}

interface StyleCardProps {
  style: KioskStyleDto;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export function StyleCard({ style, description, selected, onSelect }: StyleCardProps) {
  const tone = toneFor(style.name);

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-start transition ${
        selected ? 'border-teal bg-teal-light' : 'border-border-soft bg-white'
      }`}
    >
      <div
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: tone.light }}
      >
        {style.previewUrl ? (
          <img src={style.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full" style={{ backgroundColor: tone.dark }} />
        )}
      </div>
      <div className="flex-1">
        <p className="font-heading text-base font-semibold text-ink">{style.name}</p>
        <p className="text-sm text-ink-soft-2">{description}</p>
      </div>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-teal bg-teal text-white' : 'border-border bg-white'
        }`}
      >
        {selected && <Check size={16} />}
      </div>
    </button>
  );
}
