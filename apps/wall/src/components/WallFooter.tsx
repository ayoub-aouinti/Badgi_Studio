import type { BrandingDto } from '@badgi-studio/shared';

export function WallFooter({ branding }: { branding: BrandingDto }) {
  return (
    <footer className="flex items-center justify-between border-t border-white/10 px-16 py-6">
      {branding.logoUrl ? (
        <img src={branding.logoUrl} alt={branding.eventName} className="h-10 w-auto max-w-[260px] object-contain" />
      ) : (
        <span className="font-heading text-lg font-extrabold text-white">{branding.eventName}</span>
      )}
    </footer>
  );
}
