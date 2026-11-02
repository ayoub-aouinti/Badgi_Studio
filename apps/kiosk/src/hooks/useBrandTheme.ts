import { useEffect } from 'react';
import type { BrandingDto } from '@badgi-studio/shared';

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Light tint of the primary colour (14% over white) for selected cards and highlights.
function tint(hex: string): string {
  return rgb(hex)
    .map((c) => Math.round(255 - (255 - c) * 0.14))
    .join(' ');
}

// Applies the organiser colours (admin Branding page) as CSS variables read by Tailwind.
export function useBrandTheme(branding?: BrandingDto) {
  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement.style;
    root.setProperty('--brand', rgb(branding.primaryColor).join(' '));
    root.setProperty('--brand-light', tint(branding.primaryColor));
    root.setProperty('--brand-accent', rgb(branding.accentColor).join(' '));
    document.title = branding.eventName;
  }, [branding]);
}
