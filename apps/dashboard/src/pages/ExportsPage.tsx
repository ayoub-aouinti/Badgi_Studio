import { useEffect, useState } from 'react';
import type { PosterFormat, PosterJobDto } from '@badgi-studio/shared';
import { api } from '../lib/api';
import { useEvent } from '../lib/event-context';

const FORMATS: { value: PosterFormat; label: string }[] = [
  { value: 'A3', label: 'A3 (29,7 × 42 cm)' },
  { value: 'A2', label: 'A2 (42 × 59,4 cm)' },
  { value: 'A1', label: 'A1 (59,4 × 84,1 cm)' },
  { value: 'A0', label: 'A0 (84,1 × 118,9 cm)' },
];

export function ExportsPage() {
  const { event, errorMessage } = useEvent();
  const [zipBusy, setZipBusy] = useState(false);
  const [format, setFormat] = useState<PosterFormat>('A1');
  const [poster, setPoster] = useState<PosterJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Polls the poster job until it is done.
  useEffect(() => {
    if (!poster || poster.status === 'completed' || poster.status === 'failed') return;
    const timer = setTimeout(() => {
      api
        .getPoster(event.id, poster.jobId)
        .then(setPoster)
        .catch((err) => setError(errorMessage(err)));
    }, 1500);
    return () => clearTimeout(timer);
  }, [poster, event.id, errorMessage]);

  async function downloadZip() {
    setZipBusy(true);
    setError(null);
    try {
      const url = URL.createObjectURL(await api.downloadPortraitsZip(event.id));
      const link = document.createElement('a');
      link.href = url;
      link.download = `portraits-${event.slug}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setZipBusy(false);
    }
  }

  async function createPoster() {
    setError(null);
    try {
      setPoster(await api.createPoster(event.id, format));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const rendering = poster && (poster.status === 'waiting' || poster.status === 'active');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold">Poster du mur</h2>
        <p className="text-sm text-slate-500">
          Tous les portraits affichés sur le mur, en mosaïque sous le bandeau du congrès, prêts pour l&apos;imprimeur
          (PDF et image haute définition, 150 dpi).
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={format}
            onChange={(e) => setFormat(e.target.value as PosterFormat)}
            aria-label="Format"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            onClick={createPoster}
            disabled={Boolean(rendering)}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {rendering ? 'Génération…' : 'Générer le poster'}
          </button>
        </div>
        {poster?.status === 'completed' && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p>Poster prêt ({poster.count} portraits).</p>
            <div className="flex gap-4">
              <a href={poster.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Télécharger le PDF
              </a>
              <a href={poster.imageUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Image JPEG
              </a>
            </div>
          </div>
        )}
        {poster?.status === 'failed' && (
          <p className="text-sm text-red-600">
            {poster.error?.includes('No portrait') ? 'Aucun portrait sur le mur pour le moment.' : poster.error}
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-bold">Archive des portraits</h2>
        <p className="text-sm text-slate-500">
          Tous les portraits encadrés encore conservés (avant la purge), dans un fichier ZIP nommé par participant.
        </p>
        <button
          onClick={downloadZip}
          disabled={zipBusy}
          className="self-start rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-40"
        >
          {zipBusy ? 'Préparation…' : 'Télécharger le ZIP'}
        </button>
      </section>

      {error && <p className="text-sm text-red-600 lg:col-span-2">{error}</p>}
    </div>
  );
}
