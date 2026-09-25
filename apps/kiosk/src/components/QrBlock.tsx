import { QRCodeSVG } from 'qrcode.react';

interface QrBlockProps {
  value: string;
  label: string;
}

export function QrBlock({ value, label }: QrBlockProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border-soft bg-white p-4">
      <QRCodeSVG value={value} size={120} fgColor="#0E1B2C" />
      <p className="text-center text-xs text-ink-soft-2">{label}</p>
    </div>
  );
}
