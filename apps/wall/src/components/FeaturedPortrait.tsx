import { Sparkles } from 'lucide-react';
import type { WallFeedPortraitDto } from '@badgi-studio/shared';

export function FeaturedPortrait({ portrait }: { portrait: WallFeedPortraitDto }) {
  return (
    <div className="relative w-[560px] shrink-0">
      <div className="absolute -top-4 left-6 z-10 flex items-center gap-1 rounded-full bg-coral px-4 py-1.5 text-sm font-bold">
        <Sparkles size={16} />
        Nouveau
      </div>
      <div className="overflow-hidden rounded-[28px] border-4 border-teal-vivid shadow-2xl">
        <img
          key={portrait.portraitId}
          src={portrait.framedUrl}
          alt={portrait.participantName}
          className="aspect-square w-full object-cover"
        />
      </div>
      <div className="mt-4 text-center">
        <p className="text-2xl font-bold">{portrait.participantName}</p>
        {portrait.specialty && <p className="text-white/60">{portrait.specialty}</p>}
      </div>
    </div>
  );
}
