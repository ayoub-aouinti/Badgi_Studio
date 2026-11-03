import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mail, Printer, Sparkles } from 'lucide-react';
import { useKiosk } from '../state/kiosk-context';
import { useIdleReset } from '../hooks/useIdleReset';
import { Button } from '../components/Button';
import { QrBlock } from '../components/QrBlock';
import { API_URL, api } from '../lib/api';
import { printPortrait } from '../lib/print';

const RESULT_RESET_MS = 20000;

export function ResultScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!state.portraitResult || !state.participant) navigate('/', { replace: true });
  }, [state.portraitResult, state.participant, navigate]);

  const goHome = () => {
    dispatch({ type: 'RESET_FLOW' });
    navigate('/');
  };

  useIdleReset(RESULT_RESET_MS, goHome, Boolean(state.portraitResult));

  if (!state.portraitResult || !state.participant) return null;

  // The public page, not the raw image URL: storage URLs can expire (S3 signed URLs).
  const downloadUrl = `${API_URL}/p/${state.portraitResult.publicCode}`;
  const whatsappMessage = t('result.whatsappMessage', {
    firstName: state.participant.firstName,
    event: state.config?.branding.eventName ?? '',
    link: downloadUrl,
  });
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage ?? '')}`;

  async function print() {
    if (!state.portraitResult || !state.participant || !state.portraitId) return;
    setPrinting(true);
    try {
      await printPortrait(`${downloadUrl}/image`, state.config?.branding.eventName ?? '');
      setPrinted(true);
      // Statistics only: a failure here must not bother the participant.
      api.recordPrint(state.portraitId).catch(() => undefined);
    } catch {
      // The print dialog could not open (no printer configured on the tablet): nothing to show.
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="kiosk-shell items-center gap-6">
      <h1 className="text-center text-2xl font-bold">
        {t('result.title', { firstName: state.participant.firstName })}
      </h1>
      {state.participant.email && (
        <p className="-mt-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <Mail size={16} />
          {t('result.sentEmail')} · {state.participant.email}
        </p>
      )}

      <div className="w-full overflow-hidden rounded-2xl border border-border-soft shadow-sm">
        <img src={state.portraitResult.framedUrl} alt="" className="w-full object-cover" />
      </div>

      <div className="grid w-full grid-cols-2 gap-4">
        <QrBlock value={whatsappUrl} label={t('result.scanWhatsapp') ?? ''} />
        <QrBlock value={downloadUrl} label={t('result.scanDownload') ?? ''} />
      </div>

      <div className="flex w-full flex-col gap-3">
        {state.config?.printEnabled && (
          <Button variant="secondary" icon={<Printer size={18} />} onClick={print} disabled={printing}>
            {printed ? t('result.printed') : t('result.print')}
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<Sparkles size={18} />}
          onClick={() => {
            dispatch({ type: 'RESTART_FOR_NEW_STYLE' });
            navigate('/style');
          }}
        >
          {t('result.tryAnotherStyle')}
        </Button>
        <button onClick={goHome} className="text-sm font-semibold text-ink-soft underline">
          {t('result.finish')}
        </button>
      </div>
    </div>
  );
}
