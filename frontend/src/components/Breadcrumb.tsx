import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Consistent breadcrumb navigation for detail pages.
 * The last item is treated as the current page (not clickable).
 *
 *   <Breadcrumb items={[
 *     { label: 'Properties', href: '/properties' },
 *     { label: 'Riverside Office Park' },
 *   ]} />
 */
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-sm ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <Fragment key={`${item.label}-${idx}`}>
              <li>
                {item.href && !isLast ? (
                  <Link
                    to={item.href}
                    className="text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? 'font-medium text-gray-900' : 'text-gray-500'}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
