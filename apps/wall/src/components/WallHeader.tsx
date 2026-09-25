import { Camera } from 'lucide-react';

interface WallHeaderProps {
  eventName: string;
  portraitCount: number;
}

export function WallHeader({ eventName, portraitCount }: WallHeaderProps) {
  return (
    <header className="flex items-center justify-between px-16 pt-12">
      <div>
        <h1 className="text-4xl font-extrabold">Mur des participants</h1>
        <p className="mt-1 text-lg font-semibold text-teal-vivid">{eventName}</p>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-5xl font-extrabold tabular-nums">{portraitCount}</p>
          <p className="text-sm text-white/60">portraits générés</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-teal-vivid/40 bg-teal/20 px-5 py-3">
          <Camera size={20} className="text-teal-vivid" />
          <span className="text-sm font-semibold">Votre portrait ? Borne Studio · Hall B</span>
        </div>
      </div>
    </header>
  );
}
