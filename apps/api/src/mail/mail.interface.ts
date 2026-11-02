export const MAIL_SENDER = 'MAIL_SENDER';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  // Referenced from the HTML body as <img src="cid:...">.
  cid?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export interface MailSender {
  send(message: MailMessage): Promise<{ messageId: string }>;
}
