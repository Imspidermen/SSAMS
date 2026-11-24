import { Check, CircleDashed, Loader2, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export type StepState = 'pending' | 'current' | 'working' | 'done' | 'failed' | 'skipped';

export interface StepIndicatorItem {
  id: string;
  label: string;
  description?: string;
  state: StepState;
}

export interface StepIndicatorProps {
  steps: StepIndicatorItem[];
  ariaLabel?: string;
}

const ICONS: Record<StepState, JSX.Element> = {
  pending: <CircleDashed size={15} />,
  current: <CircleDashed size={15} />,
  working: <Loader2 size={15} className="spinner" />,
  done: <Check size={15} />,
  failed: <X size={15} />,
  skipped: <Check size={15} />,
};

const LABELS: Record<StepState, string> = {
  pending: 'Not started',
  current: 'In progress',
  working: 'Verifying',
  done: 'Passed',
  failed: 'Failed',
  skipped: 'Not required',
};

/**
 * Progress through the backend's verification pipeline. Every state is stated in
 * words as well as colour, so the sequence is readable without sight.
 */
export function StepIndicator({ steps, ariaLabel = 'Verification steps' }: StepIndicatorProps) {
  return (
    <ol className="steps" aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <li
          className={cn('steps__item', `steps__item--${step.state}`)}
          key={step.id}
          aria-current={step.state === 'current' || step.state === 'working' ? 'step' : undefined}
        >
          <span className="steps__marker" aria-hidden="true">
            {ICONS[step.state]}
          </span>
          <span className="steps__body">
            <span className="steps__label">
              <span className="steps__index">{index + 1}.</span> {step.label}
            </span>
            {step.description ? (
              <span className="steps__description">{step.description}</span>
            ) : null}
            <span className="steps__state">{LABELS[step.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
