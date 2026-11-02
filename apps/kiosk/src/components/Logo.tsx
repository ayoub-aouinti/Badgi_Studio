import { useKiosk } from '../state/kiosk-context';

// Organiser logo from the admin Branding page; falls back to the event name before the kiosk
// is paired (no config yet) or when no logo was uploaded.
export function Logo() {
  const { state } = useKiosk();
  const branding = state.config?.branding;

  if (branding?.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.eventName} className="h-12 w-auto max-w-[220px] object-contain" />;
  }
  return <span className="font-heading text-2xl font-extrabold text-ink">{branding?.eventName ?? 'Portrait Studio'}</span>;
}
