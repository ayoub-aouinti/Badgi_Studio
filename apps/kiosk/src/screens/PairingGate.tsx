import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getDeviceToken, setDeviceToken } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';

export function PairingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { dispatch } = useKiosk();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [pairError, setPairError] = useState(false);
  const [pairing, setPairing] = useState(false);

  const hasToken = Boolean(getDeviceToken());

  const configQuery = useQuery({
    queryKey: ['kiosk-config'],
    queryFn: api.getConfig,
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (configQuery.data) {
      dispatch({ type: 'SET_CONFIG', config: configQuery.data });
    }
  }, [configQuery.data, dispatch]);

  async function handlePair(event: FormEvent) {
    event.preventDefault();
    setPairing(true);
    setPairError(false);
    try {
      const { deviceToken } = await api.pair(code);
      setDeviceToken(deviceToken);
      await queryClient.invalidateQueries({ queryKey: ['kiosk-config'] });
    } catch {
      setPairError(true);
    } finally {
      setPairing(false);
    }
  }

  if (hasToken && configQuery.isLoading) {
    return (
      <div className="kiosk-shell items-center justify-center">
        <p className="text-ink-soft">{t('common.loading')}</p>
      </div>
    );
  }

  if (hasToken && configQuery.isSuccess) {
    return <>{children}</>;
  }

  return (
    <div className="kiosk-shell items-center justify-center gap-8">
      <Logo />
      <form onSubmit={handlePair} className="flex w-full flex-col gap-4">
        <div>
          <h1 className="mb-1 text-xl font-bold">{t('pairing.title')}</h1>
          <p className="text-sm text-ink-soft">{t('pairing.description')}</p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('pairing.codeLabel') ?? ''}
          inputMode="numeric"
          className="rounded-xl border border-border bg-white px-4 py-4 text-center text-2xl tracking-[0.3em]"
        />
        {pairError && <p className="text-sm text-coral">{t('pairing.invalidCode')}</p>}
        <Button type="submit" disabled={code.length !== 6 || pairing}>
          {t('pairing.submit')}
        </Button>
      </form>
    </div>
  );
}
