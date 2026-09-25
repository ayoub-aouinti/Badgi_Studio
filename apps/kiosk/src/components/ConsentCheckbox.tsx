import { Check } from 'lucide-react';

interface ConsentCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
}

export function ConsentCheckbox({ label, checked, onChange, required }: ConsentCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-border-soft bg-white p-4 text-start"
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
          checked ? 'border-teal bg-teal text-white' : 'border-border bg-white'
        }`}
      >
        {checked && <Check size={14} />}
      </span>
      <span className="text-sm text-ink-soft">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
    </button>
  );
}
