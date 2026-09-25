import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WallFeedPortraitDto, WallNewEvent, WallRemoveEvent } from '@badgi-studio/shared';
import { WS_EVENTS } from '@badgi-studio/shared';
import { fetchWallFeed } from './lib/api';
import { connectWall, onEvent } from './lib/socket';
import { WallHeader } from './components/WallHeader';
import { FeaturedPortrait } from './components/FeaturedPortrait';
import { PortraitTile } from './components/PortraitTile';
import { WallFooter } from './components/WallFooter';

const GRID_SIZE = 10;
const MAX_PORTRAITS = GRID_SIZE + 1; // 1 featured + grid

export function WallScreen() {
  const feedQuery = useQuery({ queryKey: ['wall-feed'], queryFn: fetchWallFeed });
  const [portraits, setPortraits] = useState<WallFeedPortraitDto[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    connectWall();
  }, []);

  useEffect(() => {
    if (feedQuery.data) {
      setPortraits(feedQuery.data.portraits);
      setCount(feedQuery.data.portraitCount);
    }
  }, [feedQuery.data]);

  useEffect(() => {
    const offNew = onEvent<WallNewEvent>(WS_EVENTS.WALL_NEW, (event) => {
      setPortraits((prev) =>
        [
          {
            portraitId: event.portraitId,
            framedUrl: event.framedUrl,
            participantName: event.participantName,
            specialty: event.specialty,
            createdAt: new Date().toISOString(),
          },
          ...prev.filter((p) => p.portraitId !== event.portraitId),
        ].slice(0, MAX_PORTRAITS),
      );
      setCount((c) => c + 1);
    });

    const offRemove = onEvent<WallRemoveEvent>(WS_EVENTS.WALL_REMOVE, (event) => {
      setPortraits((prev) => prev.filter((p) => p.portraitId !== event.portraitId));
      setCount((c) => Math.max(0, c - 1));
    });

    return () => {
      offNew();
      offRemove();
    };
  }, []);

  if (feedQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-white/60">
        Chargement du mur…
      </div>
    );
  }

  if (feedQuery.isError || !feedQuery.data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-coral">
        Impossible de charger le mur (jeton invalide ?)
      </div>
    );
  }

  const [featured, ...rest] = portraits;
  const grid = rest.slice(0, GRID_SIZE);

  return (
    <div className="flex h-screen w-screen flex-col">
      <WallHeader eventName={feedQuery.data.eventName} portraitCount={count} />

      <main className="flex flex-1 items-center gap-16 px-16 py-10">
        {featured ? (
          <FeaturedPortrait portrait={featured} />
        ) : (
          <div className="flex w-[560px] shrink-0 items-center justify-center text-white/40">
            En attente du premier portrait…
          </div>
        )}

        <div className="grid flex-1 grid-cols-5 grid-rows-2 gap-6">
          {grid.map((portrait) => (
            <PortraitTile key={portrait.portraitId} portrait={portrait} />
          ))}
        </div>
      </main>

      <WallFooter sponsorName={feedQuery.data.sponsorName} sponsorLogoUrl={feedQuery.data.sponsorLogoUrl} />
    </div>
  );
}
