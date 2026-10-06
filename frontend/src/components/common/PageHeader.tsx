import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Rendered under the subtitle (tabs, filter chips, status banners). */
  children?: ReactNode;
}

/** Standard page header: breadcrumb trail, title, description, actions. */
export function PageHeader({ title, subtitle, actions, breadcrumbs, children }: PageHeaderProps) {
  return (
    <header className="page-header-wrap">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span
                key={`${crumb.label}-${index}`}
                className="row"
                style={{ gap: 'var(--space-2)' }}
              >
                {crumb.to && !isLast ? (
                  <Link to={crumb.to}>{crumb.label}</Link>
                ) : (
                  <span
                    className={isLast ? 'breadcrumb__current' : undefined}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast ? (
                  <ChevronRight className="breadcrumb__sep" size={13} aria-hidden="true" />
                ) : null}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>

      {children}
    </header>
  );
}
