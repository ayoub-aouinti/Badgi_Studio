import { useState } from 'react';
import type { EventStatsDto } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useEventData } from '../lib/event-context';

// Single-series charts: one hue (validated blue, >= 3:1 on the white card), thin marks.
const BAR_COLOR = '#2a78d6';
const MAX_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

export function StatsPage() {
  const { data: stats, error } = useEventData(api.getStats, 30000);

  if (!stats) return <p className="text-slate-500">{error ?? 'Chargement…'}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Portraits générés" value={stats.portraitsReady} />
        <Tile label="Participants" value={stats.participants} />
        <Tile
          label="Emails envoyés"
          value={stats.emailsSent}
          note={stats.emailsFailed ? `${stats.emailsFailed} en échec` : undefined}
        />
        <Tile label="Coût IA" value={`${stats.aiCostUsd.toFixed(2)} $`} />
        <Tile label="Sur le mur" value={stats.onWall} />
        <Tile label="À modérer" value={stats.pendingModeration} />
        <Tile
          label="Refusés automatiquement"
          value={stats.autoRejected}
          note={stats.portraitsFailed ? `${stats.portraitsFailed} génération(s) en échec` : undefined}
        />
        <Tile label="Bornes en ligne" value={`${stats.kiosksOnline} / ${stats.kiosksTotal}`} />
      </div>

      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Portraits par heure</h2>
        <p className="mb-4 text-sm text-slate-500">Portraits générés, {MAX_HOURS} dernières heures d&apos;activité au plus.</p>
        <HourlyChart byHour={stats.byHour} />
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold">Portraits par style</h2>
        <StyleBars byStyle={stats.byStyle} />
      </section>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

const hourLabel = (date: Date) => `${date.getHours()}h`;
const dayLabel = (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

// Continuous hours (empty ones as 0) from the first to the last active hour, capped.
function fillHours(byHour: EventStatsDto['byHour']): { start: Date; count: number }[] {
  if (byHour.length === 0) return [];
  const counts = new Map(byHour.map((row) => [new Date(row.hour).getTime(), row.count]));
  const last = new Date(byHour[byHour.length - 1].hour).getTime();
  const first = Math.max(new Date(byHour[0].hour).getTime(), last - (MAX_HOURS - 1) * HOUR_MS);
  const hours = [];
  for (let t = first; t <= last; t += HOUR_MS) hours.push({ start: new Date(t), count: counts.get(t) ?? 0 });
  return hours;
}

function HourlyChart({ byHour }: { byHour: EventStatsDto['byHour'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hours = fillHours(byHour);
  if (hours.length === 0) return <p className="text-sm text-slate-500">Aucun portrait pour le moment.</p>;

  const max = Math.max(...hours.map((h) => h.count));
  const peak = hours.findIndex((h) => h.count === max);
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, all) => all.indexOf(v) === i);
  const labelEvery = Math.ceil(hours.length / 12);
  const active = hovered === null ? null : hours[hovered];

  return (
    <div>
      <div className="flex gap-2">
        {/* y axis */}
        <div className="relative h-48 w-8 shrink-0 text-right text-xs text-slate-500">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (tick / max) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* recessive grid */}
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-slate-100"
              style={{ top: `${100 - (tick / max) * 100}%` }}
            />
          ))}
          <div className="relative flex h-48 items-end border-b border-slate-300" onMouseLeave={() => setHovered(null)}>
            {hours.map((hour, i) => (
              // The whole slot is the hit target, not just the (thin) bar.
              <div
                key={hour.start.getTime()}
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHovered(i)}
              >
                {i === peak && max > 0 && (
                  <span
                    className="absolute text-xs font-semibold text-slate-700"
                    style={{ bottom: `calc(${(hour.count / max) * 100}% + 4px)` }}
                  >
                    {hour.count}
                  </span>
                )}
                {hour.count > 0 && (
                  <div
                    className="w-full max-w-[24px] rounded-t mx-px"
                    style={{
                      height: `${(hour.count / max) * 100}%`,
                      background: BAR_COLOR,
                      opacity: hovered === null || hovered === i ? 1 : 0.55,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {active && hovered !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow"
              style={{ left: `${((hovered + 0.5) / hours.length) * 100}%` }}
            >
              <p className="font-semibold">
                {dayLabel(active.start)}, {hourLabel(active.start)}–{hourLabel(new Date(active.start.getTime() + HOUR_MS))}
              </p>
              <p>
                {active.count} portrait{active.count > 1 ? 's' : ''}
              </p>
            </div>
          )}
          {/* x axis */}
          <div className="mt-1 flex text-xs text-slate-500">
            {hours.map((hour, i) => (
              <span key={hour.start.getTime()} className="min-w-0 flex-1 text-center">
                {i % labelEvery === 0 ? hourLabel(hour.start) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-500">Voir les données</summary>
        <table className="mt-2 text-left">
          <thead className="text-slate-500">
            <tr>
              <th className="pr-6 font-semibold">Heure</th>
              <th className="text-right font-semibold">Portraits</th>
            </tr>
          </thead>
          <tbody>
            {byHour.map((row) => (
              <tr key={row.hour}>
                <td className="pr-6">
                  {dayLabel(new Date(row.hour))}, {hourLabel(new Date(row.hour))}
                </td>
                <td className="text-right tabular-nums">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function StyleBars({ byStyle }: { byStyle: EventStatsDto['byStyle'] }) {
  const max = Math.max(1, ...byStyle.map((style) => style.count));
  return (
    <div className="flex flex-col gap-3">
      {byStyle.map((style) => (
        <div key={style.styleId} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate text-slate-700">{style.name}</span>
          <div className="flex items-center gap-2" title={`${style.name} : ${style.count}`}>
            {style.count > 0 && (
              <div className="h-5 rounded-r" style={{ width: `${(style.count / max) * 100}%`, background: BAR_COLOR }} />
            )}
            <span className="tabular-nums text-slate-700">{style.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
