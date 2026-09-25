interface WallFooterProps {
  sponsorName?: string;
  sponsorLogoUrl?: string;
}

export function WallFooter({ sponsorName, sponsorLogoUrl }: WallFooterProps) {
  return (
    <footer className="flex items-center justify-between border-t border-white/10 px-16 py-6">
      <div className="flex items-center gap-2 text-white/70">
        <span className="font-heading text-lg font-extrabold text-white">badgi</span>
        <span className="rounded-full bg-teal px-2 py-0.5 text-xs font-semibold text-white">Studio</span>
      </div>
      {sponsorName && (
        <div className="flex items-center gap-3 text-white/70">
          {sponsorLogoUrl && <img src={sponsorLogoUrl} alt={sponsorName} className="h-8 w-auto" />}
          <span className="text-sm">Offert par {sponsorName}</span>
        </div>
      )}
    </footer>
  );
}
