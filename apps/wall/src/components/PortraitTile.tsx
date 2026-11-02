import type { WallFeedPortraitDto } from '@badgi-studio/shared';

export function PortraitTile({ portrait }: { portrait: WallFeedPortraitDto }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <img src={portrait.framedUrl} alt={portrait.participantName} className="aspect-square w-full object-contain" />
      </div>
      <div className="text-center">
        <p className="truncate text-sm font-semibold">{portrait.participantName}</p>
      </div>
    </div>
  );
}
