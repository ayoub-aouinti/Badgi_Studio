import { Check } from 'lucide-react';

interface Step {
  key: string;
  label: string;
}

interface ProgressStepsProps {
  steps: Step[];
  activeIndex: number;
}

export function ProgressSteps({ steps, activeIndex }: ProgressStepsProps) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                done
                  ? 'border-teal bg-teal text-white'
                  : active
                    ? 'border-teal text-teal'
                    : 'border-border text-ink-soft-2'
              }`}
            >
              {done ? <Check size={14} /> : index + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
