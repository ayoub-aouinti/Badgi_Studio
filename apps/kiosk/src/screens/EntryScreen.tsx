import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useKiosk } from '../state/kiosk-context';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';

export function EntryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dispatch } = useKiosk();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const createParticipant = useMutation({
    mutationFn: api.createParticipant,
    onSuccess: ({ participantId }) => {
      dispatch({
        type: 'SET_PARTICIPANT',
        participant: { id: participantId, firstName, lastName, email: email.trim() || undefined },
      });
      navigate('/style');
    },
  });

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    createParticipant.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      whatsappE164: whatsapp.trim() ? `+216${whatsapp.trim()}` : undefined,
    });
  }

  return (
    <div className="kiosk-shell">
      <StepHeader current={1} total={3} onBack={() => navigate('/')} />
      <h1 className="mb-6 text-2xl font-bold">{t('entry.title')}</h1>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <Field label={t('entry.firstName')} value={firstName} onChange={setFirstName} required />
        <Field label={t('entry.lastName')} value={lastName} onChange={setLastName} required />
        <Field label={t('entry.email')} value={email} onChange={setEmail} type="email" />

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">{t('entry.whatsapp')}</label>
          <div className="flex overflow-hidden rounded-xl border border-border bg-white">
            <span className="flex items-center bg-border-soft px-3 text-sm font-semibold text-ink-soft">
              +216
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              className="flex-1 px-3 py-3 outline-none"
            />
          </div>
        </div>

        <p className="text-xs text-ink-soft-2">{t('entry.contactNote')}</p>

        <div className="mt-auto">
          <Button type="submit" disabled={!canSubmit || createParticipant.isPending}>
            {t('entry.continue')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-ink-soft">
        {label}
        {required && <span className="text-coral"> *</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-teal"
      />
    </div>
  );
}
