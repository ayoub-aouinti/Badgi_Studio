import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { AdminPortraitDto, BrandingDto, FrameStyle, StylePreset } from '@badgi-studio/shared';
import { api, clearToken, getToken, UnauthorizedError, type AdminStyle } from './lib/api';

const FRAME_STYLES: { value: FrameStyle; label: string; hint: string }[] = [
  { value: 'banner', label: 'Bandeau', hint: 'Bandeau en bas du portrait' },
  { value: 'border', label: 'Contour', hint: 'Cadre coloré autour du portrait' },
  { value: 'polaroid', label: 'Polaroid', hint: 'Contour avec grande marge en bas' },
  { value: 'none', label: 'Sans cadre', hint: 'Portrait seul (logo en coin)' },
];

const STYLE_HINTS: Record<StylePreset, string> = {
  pro: 'Portrait retouché, sobre',
  caricature: 'Grosse tête, grands yeux, illustration',
  pencil: 'Dessin au crayon noir',
  painted: 'Portrait peint',
  comic: 'Bande dessinée, aplats et encrage',
};

type Page = 'branding' | 'portraits';

const PAGES: { value: Page; label: string }[] = [
  { value: 'branding', label: 'Branding & styles' },
  { value: 'portraits', label: 'Portraits' },
];

export function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [page, setPage] = useState<Page>('branding');
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const onLogout = () => {
    clearToken();
    setAuthed(false);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <nav className="flex gap-2">
          {PAGES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPage(p.value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                page === p.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="text-sm text-slate-500 underline">
          Déconnexion
        </button>
      </header>
      {page === 'branding' ? <BrandingPage onLogout={onLogout} /> : <PortraitsPage onLogout={onLogout} />}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-bold">Portrait Studio — Admin</h1>
        <div>
          <label className="field-label">Mot de passe</label>
          <input
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-lg bg-slate-900 py-2 font-semibold text-white">Connexion</button>
      </form>
    </div>
  );
}

function BrandingPage({ onLogout }: { onLogout: () => void }) {
  const [saved, setSaved] = useState<BrandingDto | null>(null);
  const [draft, setDraft] = useState<BrandingDto | null>(null);
  const [styles, setStyles] = useState<AdminStyle[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onLogout();
      else setStatus((err as Error).message);
    },
    [onLogout],
  );

  const refreshPreview = useCallback(() => {
    api
      .previewUrl()
      .then((url) => setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      }))
      .catch(handleError);
  }, [handleError]);

  useEffect(() => {
    Promise.all([api.getBranding(), api.getStyles()])
      .then(([branding, list]) => {
        setSaved(branding);
        setDraft(branding);
        setStyles(list);
      })
      .catch(handleError);
    refreshPreview();
  }, [handleError, refreshPreview]);

  if (!draft || !saved) return <p className="p-8 text-slate-500">{status ?? 'Chargement…'}</p>;

  const dirty = JSON.stringify({ ...draft, logoUrl: undefined }) !== JSON.stringify({ ...saved, logoUrl: undefined });
  const set = <K extends keyof BrandingDto>(key: K, value: BrandingDto[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function run(action: () => Promise<void>, okMessage: string) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus(okMessage);
      refreshPreview();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const { logoUrl: _logo, ...fields } = draft;
      const updated = await api.updateBranding(fields);
      setSaved(updated);
      setDraft(updated);
    }, 'Enregistré');

  const uploadLogo = (file: File) =>
    run(async () => {
      const updated = await api.uploadLogo(file);
      setSaved((s) => (s ? { ...s, logoUrl: updated.logoUrl } : s));
      setDraft((d) => (d ? { ...d, logoUrl: updated.logoUrl } : d));
    }, 'Logo mis à jour');

  const removeLogo = () =>
    run(async () => {
      const updated = await api.removeLogo();
      setSaved((s) => (s ? { ...s, logoUrl: updated.logoUrl } : s));
      setDraft((d) => (d ? { ...d, logoUrl: updated.logoUrl } : d));
    }, 'Logo supprimé');

  const toggleStyle = (style: AdminStyle) =>
    api
      .setStyleActive(style.id, !style.active)
      .then((updated) => setStyles((list) => list.map((s) => (s.id === updated.id ? updated : s))))
      .catch(handleError);

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4">
            <h2 className="text-lg font-bold">Identité</h2>
            <div>
              <label className="field-label">Nom de l&apos;événement</label>
              <input className="field-input" value={draft.eventName} onChange={(e) => set('eventName', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Slogan (facultatif)</label>
              <input
                className="field-input"
                value={draft.tagline ?? ''}
                onChange={(e) => set('tagline', e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Logo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  {saved.logoUrl ? (
                    <img src={saved.logoUrl} alt="Logo" className="max-h-16 max-w-28 object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Aucun logo</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  {saved.logoUrl ? 'Remplacer' : 'Ajouter un logo'}
                </button>
                {saved.logoUrl && (
                  <button onClick={removeLogo} disabled={busy} className="text-sm text-red-600 underline">
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Couleur principale" value={draft.primaryColor} onChange={(v) => set('primaryColor', v)} />
              <ColorField label="Couleur d'accent" value={draft.accentColor} onChange={(v) => set('accentColor', v)} />
            </div>
          </section>

          <section className="card flex flex-col gap-4">
            <h2 className="text-lg font-bold">Cadre du portrait</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FRAME_STYLES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => set('frameStyle', f.value)}
                  title={f.hint}
                  className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold ${
                    draft.frameStyle === f.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  {f.label}
                  <span className="mt-1 block text-xs font-normal text-slate-500">{f.hint}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Couleur du cadre" value={draft.frameColor} onChange={(v) => set('frameColor', v)} />
              <div>
                <label className="field-label">Épaisseur du contour ({draft.frameWidth}px)</label>
                <input
                  type="range"
                  min={8}
                  max={96}
                  value={draft.frameWidth}
                  disabled={draft.frameStyle === 'none' || draft.frameStyle === 'banner'}
                  onChange={(e) => set('frameWidth', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.showName} onChange={(e) => set('showName', e.target.checked)} />
              Afficher le nom du participant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.showLogo} onChange={(e) => set('showLogo', e.target.checked)} />
              Afficher le logo sur le portrait
            </label>
          </section>

          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-bold">Styles proposés sur la borne</h2>
            {styles.map((style) => (
              <label key={style.id} className="flex items-center gap-3">
                <input type="checkbox" checked={style.active} onChange={() => toggleStyle(style)} />
                <span className="font-semibold">{style.name}</span>
                <span className="text-sm text-slate-500">{STYLE_HINTS[style.preset] ?? ''}</span>
              </label>
            ))}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card flex flex-col gap-4">
            <h2 className="text-lg font-bold">Aperçu</h2>
            {previewUrl ? (
              <img src={previewUrl} alt="Aperçu du portrait encadré" className="w-full rounded-lg border border-slate-200" />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-lg bg-slate-100" />
            )}
            <p className="text-xs text-slate-500">
              L&apos;aperçu montre la dernière version enregistrée, avec un portrait fictif.
            </p>
            <button
              onClick={save}
              disabled={!dirty || busy}
              className="rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {status && <p className="text-sm text-slate-600">{status}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<AdminPortraitDto['status'], string> = {
  QUEUED: 'En attente',
  MODERATING: 'Vérification',
  GENERATING: 'Génération',
  READY: 'Prêt',
  REJECTED: 'Rejeté',
  FAILED: 'Échec',
};

function PortraitsPage({ onLogout }: { onLogout: () => void }) {
  const [portraits, setPortraits] = useState<AdminPortraitDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof UnauthorizedError) onLogout();
      else setError((err as Error).message);
    },
    [onLogout],
  );

  const load = useCallback(() => {
    api.getPortraits().then(setPortraits).catch(handleError);
  }, [handleError]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function setOnWall(portrait: AdminPortraitDto, onWall: boolean) {
    setPending(portrait.id);
    setError(null);
    try {
      const updated = await api.updatePortrait(portrait.id, { onWall });
      setPortraits((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
    } catch (err) {
      handleError(err);
    } finally {
      setPending(null);
    }
  }

  if (!portraits) return <p className="text-slate-500">{error ?? 'Chargement…'}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Portraits</h1>
        <span className="text-sm text-slate-500">{portraits.length} plus récents</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {portraits.length === 0 && <p className="text-slate-500">Aucun portrait pour le moment.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {portraits.map((portrait) => (
          <article key={portrait.id} className="card flex flex-col gap-2 p-3">
            {portrait.imageUrl ? (
              <a href={portrait.imageUrl} target="_blank" rel="noreferrer">
                <img src={portrait.imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
              </a>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                {portrait.purged ? 'Supprimé (purge)' : STATUS_LABELS[portrait.status]}
              </div>
            )}
            <div className="text-sm">
              <p className="truncate font-semibold">{portrait.participantName}</p>
              <p className="truncate text-xs text-slate-500">
                {portrait.styleName} · {new Date(portrait.createdAt).toLocaleString('fr-FR')}
              </p>
            </div>
            <PortraitWallControl
              portrait={portrait}
              busy={pending === portrait.id}
              onChange={(onWall) => setOnWall(portrait, onWall)}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function PortraitWallControl({
  portrait,
  busy,
  onChange,
}: {
  portrait: AdminPortraitDto;
  busy: boolean;
  onChange: (onWall: boolean) => void;
}) {
  if (portrait.purged || portrait.status !== 'READY') return null;
  if (portrait.onWall) {
    return (
      <button
        onClick={() => onChange(false)}
        disabled={busy}
        className="rounded-lg border border-red-200 py-1.5 text-sm font-semibold text-red-600 disabled:opacity-40"
      >
        Retirer du mur
      </button>
    );
  }
  if (!portrait.wallConsent) {
    return <p className="py-1.5 text-center text-xs text-slate-400">Pas de consentement mur</p>;
  }
  return (
    <button
      onClick={() => onChange(true)}
      disabled={busy}
      className="rounded-lg border border-slate-300 py-1.5 text-sm font-semibold disabled:opacity-40"
    >
      Remettre sur le mur
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded border border-slate-300"
        />
        <input className="field-input font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
