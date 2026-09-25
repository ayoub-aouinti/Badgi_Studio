import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Printer, Sparkles } from 'lucide-react';
import { useKiosk } from '../state/kiosk-context';
import { useIdleReset } from '../hooks/useIdleReset';
import { Button } from '../components/Button';
import { QrBlock } from '../components/QrBlock';
import { API_URL } from '../lib/api';

const RESULT_RESET_MS = 20000;

export function ResultScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useKiosk();

  useEffect(() => {
    if (!state.portraitResult || !state.participant) navigate('/', { replace: true });
  }, [state.portraitResult, state.participant, navigate]);

  const goHome = () => {
    dispatch({ type: 'RESET_FLOW' });
    navigate('/');
  };

  useIdleReset(RESULT_RESET_MS, goHome, Boolean(state.portraitResult));

  if (!state.portraitResult || !state.participant) return null;

  const whatsappMessage = t('result.whatsappMessage', {
    firstName: state.participant.firstName,
    event: state.config?.eventName ?? '',
    link: state.portraitResult.framedUrl,
  });
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage ?? '')}`;
  const downloadUrl = `${API_URL}/p/${state.portraitResult.publicCode}`;

  return (
    <div className="kiosk-shell items-center gap-6">
      <h1 className="text-center text-2xl font-bold">
        {t('result.title', { firstName: state.participant.firstName })}
      </h1>

      <div className="w-full overflow-hidden rounded-2xl border border-border-soft shadow-sm">
        <img src={state.portraitResult.framedUrl} alt="" className="w-full object-cover" />
      </div>

      <div className="grid w-full grid-cols-2 gap-4">
        <QrBlock value={whatsappUrl} label={t('result.scanWhatsapp') ?? ''} />
        <QrBlock value={downloadUrl} label={t('result.scanDownload') ?? ''} />
      </div>

      <div className="flex w-full flex-col gap-3">
        <button disabled className="btn-secondary gap-2 opacity-40" title="V2">
          <Printer size={18} />
          {t('result.print')}
        </button>
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
