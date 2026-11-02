import { BookOpen, Check, Laugh, Palette, Pencil, UserRound, type LucideIcon } from 'lucide-react';
import type { KioskStyleDto, StylePreset } from '@badgi-studio/shared';

const TONES: Record<StylePreset, { light: string; dark: string; icon: LucideIcon }> = {
  pro: { light: '#DDE5EE', dark: '#2D4A6B', icon: UserRound },
  caricature: { light: '#F8DDD3', dark: '#9A3B20', icon: Laugh },
  pencil: { light: '#E4E4E4', dark: '#1F1F1F', icon: Pencil },
  painted: { light: '#F3E6CC', dark: '#8A5A12', icon: Palette },
  comic: { light: '#FFF1B8', dark: '#B42318', icon: BookOpen },
};

interface StyleCardProps {
  style: KioskStyleDto;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export function StyleCard({ style, description, selected, onSelect }: StyleCardProps) {
  const tone = TONES[style.preset] ?? TONES.pro;

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
          <tone.icon size={30} strokeWidth={1.75} style={{ color: tone.dark }} />
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
