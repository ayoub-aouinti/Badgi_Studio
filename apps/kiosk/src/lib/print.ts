// Prints the portrait on the printer attached to the tablet (AirPrint / Mopria / USB), through
// the browser's own print dialog: a 10x15 cm photo page, rendered in a hidden iframe so the
// kiosk screen itself is not printed.
export function printPortrait(imageUrl: string, caption: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    frame.srcdoc = `<!doctype html><html><head><style>
      @page { size: 100mm 150mm; margin: 0; }
      html, body { margin: 0; }
      body { width: 100mm; height: 150mm; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 6mm; font-family: system-ui, sans-serif; }
      img { width: 92mm; height: 92mm; object-fit: cover; }
      p { margin: 0; font-size: 11pt; color: #0E1B2C; }
    </style></head><body><img src="${escape(imageUrl)}" alt=""><p>${escape(caption)}</p></body></html>`;

    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    frame.onload = () => {
      const doc = frame.contentDocument;
      const image = doc?.querySelector('img');
      const print = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          cleanup();
        }
      };
      if (!image || image.complete) print();
      else {
        image.onload = print;
        image.onerror = () => {
          cleanup();
          reject(new Error('Portrait image could not be loaded'));
        };
      }
    };
    document.body.appendChild(frame);
  });
}
