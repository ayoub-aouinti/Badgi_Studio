import { MailMessage } from '../mail/mail.interface';

// docs/SCREENS.md §Email: framed portrait + "Bonjour Amira, voici votre portrait du [congrès]".

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PortraitEmailData {
  to: string;
  firstName: string;
  eventName: string;
  primaryColor: string;
  publicUrl: string;
  framedImage: Buffer;
}

const IMAGE_CID = 'portrait@badgi-studio';

export function buildPortraitEmail(data: PortraitEmailData): MailMessage {
  const color = /^#[0-9a-fA-F]{6}$/.test(data.primaryColor) ? data.primaryColor : '#0B6E69';
  const firstName = escapeHtml(data.firstName);
  const eventName = escapeHtml(data.eventName);
  const url = escapeHtml(data.publicUrl);

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#F4F6F5;font-family:Arial,Helvetica,sans-serif;color:#0E1B2C">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;padding:24px">
      <tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px">Bonjour ${firstName},</td></tr>
      <tr><td style="font-size:15px;line-height:1.5;padding-bottom:16px">Voici votre portrait du ${eventName}.</td></tr>
      <tr><td><img src="cid:${IMAGE_CID}" alt="Votre portrait" width="432" style="width:100%;border-radius:12px;display:block"></td></tr>
      <tr><td align="center" style="padding:20px 0 8px">
        <a href="${url}" style="background:${color};color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;display:inline-block">Télécharger en HD</a>
      </td></tr>
      <tr><td style="font-size:12px;color:#7B8794;text-align:center">Le portrait est conservé pendant une durée limitée puis supprimé automatiquement.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = [
    `Bonjour ${data.firstName},`,
    '',
    `Voici votre portrait du ${data.eventName}.`,
    `Version HD : ${data.publicUrl}`,
  ].join('\n');

  return {
    to: data.to,
    subject: `Votre portrait — ${data.eventName}`,
    html,
    text,
    attachments: [
      { filename: 'portrait.jpg', content: data.framedImage, contentType: 'image/jpeg', cid: IMAGE_CID },
    ],
  };
}
