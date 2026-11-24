import type { Tone } from '@/utils/attendance';
import { getInitials } from '@/utils/format';
import { cn } from '@/utils/cn';

const TONE_CLASS: Partial<Record<Tone, string>> = {
  success: 'avatar--tone-success',
  warning: 'avatar--tone-warning',
  danger: 'avatar--tone-danger',
  neutral: 'avatar--tone-neutral',
};

export interface AvatarProps {
  name: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tone?: Tone;
  className?: string;
  /** Optional small status dot (bottom-right). */
  status?: 'online' | 'offline';
}

/**
 * Deterministic initials avatar.
 *
 * The backend stores no profile photograph - student identity is a face
 * *embedding* produced by the CV service and raw images are never persisted.
 * Initials are therefore the honest representation of a user in this product.
 */
export function Avatar({ name, size = 'md', tone, className, status }: AvatarProps) {
  return (
    <span
      className={cn('avatar', `avatar--${size}`, tone ? TONE_CLASS[tone] : undefined, className)}
      role="img"
      aria-label={name ? `${name} avatar` : 'User avatar'}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
      {status ? (
        <span
          className={cn('avatar__status', status === 'online' && 'avatar__status--online')}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
