import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Removes body padding so tables can bleed to the card edges. */
  flush?: boolean;
  as?: 'div' | 'section' | 'article';
  ariaLabel?: string;
  style?: CSSProperties;
}

export function Card({
  children,
  className,
  flush = false,
  as = 'div',
  ariaLabel,
  style,
}: CardProps) {
  const Tag = as;
  return (
    <Tag
      className={cn('card', flush && 'card--flush', className)}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Renders the title as a heading of this level (defaults to none). */
  headingLevel?: 2 | 3;
}

export function CardHeader({ title, subtitle, actions, className, headingLevel }: CardHeaderProps) {
  const TitleTag = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'div';
  return (
    <div className={cn('card__header', className)}>
      <div className="card__header-main">
        <TitleTag className="card__title">{title}</TitleTag>
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </div>
  );
}

export interface CardBodyProps {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}

export function CardBody({ children, className, tight = false }: CardBodyProps) {
  return (
    <div className={cn('card__body', tight && 'card__body--tight', className)}>{children}</div>
  );
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <div className={cn('card__footer', className)}>{children}</div>;
}
