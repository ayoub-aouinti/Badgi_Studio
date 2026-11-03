import type { ReactNode } from 'react';
import type { AdminPortraitDto } from '@badgi-studio/shared';

const STATUS_LABELS: Record<AdminPortraitDto['status'], string> = {
  QUEUED: 'En attente',
  MODERATING: 'Vérification',
  GENERATING: 'Génération',
  READY: 'Prêt',
  REJECTED: 'Refusé automatiquement',
  FAILED: 'Échec',
};

const MODERATION_BADGES: Partial<Record<AdminPortraitDto['moderation'], { label: string; className: string }>> = {
  PENDING: { label: 'À modérer', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Approuvé', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Rejeté', className: 'bg-red-100 text-red-700' },
};

export function PortraitCard({ portrait, children }: { portrait: AdminPortraitDto; children?: ReactNode }) {
  const badge = portrait.status === 'READY' ? MODERATION_BADGES[portrait.moderation] : undefined;
  return (
    <article className="card flex flex-col gap-2 p-3">
      {portrait.imageUrl ? (
        <a href={portrait.imageUrl} target="_blank" rel="noreferrer">
          <img src={portrait.imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 p-3 text-center text-xs text-slate-400">
          {portrait.purged ? 'Supprimé (purge)' : STATUS_LABELS[portrait.status]}
        </div>
      )}
      <div className="text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{portrait.participantName}</p>
          {badge && <span className={`shrink-0 rounded-full px-2 text-xs font-semibold ${badge.className}`}>{badge.label}</span>}
        </div>
        <p className="truncate text-xs text-slate-500">
          {portrait.styleName} · {new Date(portrait.createdAt).toLocaleString('fr-FR')}
        </p>
        {portrait.moderationReason && <p className="mt-1 text-xs text-red-600">{portrait.moderationReason}</p>}
        {portrait.videoUrl && (
          <a href={portrait.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-600 underline">
            Vidéo du dessin
          </a>
        )}
      </div>
      {children}
    </article>
  );
}
