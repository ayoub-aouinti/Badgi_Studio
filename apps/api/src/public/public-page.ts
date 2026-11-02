// Server-rendered HTML for the public download page (docs/SPEC.md: GET /p/:code).
// Kept dependency-free: guests open it from a QR code, an email or WhatsApp on their phone.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value : fallback;
}

interface ShellOptions {
  title: string;
  primaryColor: string;
  body: string;
}

function shell({ title, primaryColor, body }: ShellOptions): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root { --primary: ${safeColor(primaryColor, '#0B6E69')}; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #F4F6F5; color: #0E1B2C; display: flex; justify-content: center; padding: 24px 16px; }
  main { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 20px; }
  header { text-align: center; }
  .event { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--primary); }
  h1 { margin: 6px 0 0; font-size: 24px; line-height: 1.25; }
  .tagline { margin: 6px 0 0; color: #52606D; font-size: 14px; }
  img { width: 100%; border-radius: 16px; box-shadow: 0 8px 24px rgba(14, 27, 44, .15); display: block; }
  .actions { display: flex; flex-direction: column; gap: 10px; }
  .btn { display: block; text-align: center; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 16px;
    text-decoration: none; border: 0; cursor: pointer; font-family: inherit; }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-secondary { background: #fff; color: var(--primary); border: 2px solid var(--primary); }
  [hidden] { display: none !important; }
  .note { text-align: center; font-size: 12px; color: #7B8794; }
  .empty { text-align: center; padding: 48px 0; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export interface PortraitPageData {
  code: string;
  firstName: string;
  eventName: string;
  tagline?: string;
  primaryColor: string;
  purgeAt: Date;
}

export function renderPortraitPage(data: PortraitPageData): string {
  const imagePath = `/p/${encodeURIComponent(data.code)}/image`;
  const purgeDate = data.purgeAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `
  <header>
    <p class="event">${escapeHtml(data.eventName)}</p>
    <h1>Bonjour ${escapeHtml(data.firstName)}, voici votre portrait</h1>
    ${data.tagline ? `<p class="tagline">${escapeHtml(data.tagline)}</p>` : ''}
  </header>
  <img src="${imagePath}" alt="Portrait de ${escapeHtml(data.firstName)}">
  <div class="actions">
    <a class="btn btn-primary" href="${imagePath}?download=1" download>Télécharger en HD</a>
    <button class="btn btn-secondary" id="share" hidden>Partager</button>
  </div>
  <p class="note">Ce portrait sera supprimé automatiquement le ${escapeHtml(purgeDate)}.</p>
  <script>
    (function () {
      var button = document.getElementById('share');
      if (!navigator.share) return;
      button.hidden = false;
      button.addEventListener('click', function () {
        navigator.share({ title: document.title, url: location.href }).catch(function () {});
      });
    })();
  </script>`;
  return shell({ title: `Portrait — ${data.eventName}`, primaryColor: data.primaryColor, body });
}

export function renderNotFoundPage(): string {
  return shell({
    title: 'Portrait introuvable',
    primaryColor: '#0B6E69',
    body: `
  <div class="empty">
    <h1>Portrait introuvable</h1>
    <p class="tagline">Ce lien n'est plus valide : le portrait a peut-être été supprimé
    (les portraits sont conservés pendant une durée limitée).</p>
  </div>`,
  });
}
