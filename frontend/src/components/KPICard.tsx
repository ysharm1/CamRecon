import { Link } from 'react-router-dom';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: { value: string; tone: 'positive' | 'negative' | 'neutral' };
  icon?: LucideIcon;
  href?: string;
  highlight?: boolean;
  hint?: string;
}

/**
 * Compact KPI card used in snapshot rows on detail pages.
 * Optionally clickable when an `href` is provided.
 *
 *   <KPICard label="Annual Rent" value="$540,000" delta={{ value: '+3.2%', tone: 'positive' }} />
 */
export function KPICard({ label, value, delta, icon: Icon, href, highlight, hint }: KPICardProps) {
  const content = (
    <div
      className={`rounded-lg border p-4 transition-shadow ${
        highlight
          ? 'border-indigo-200 bg-indigo-50/30'
          : 'border-gray-200 bg-white'
      } ${href ? 'cursor-pointer hover:shadow-sm hover:border-gray-300' : ''}`}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && !delta && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {delta.tone === 'positive' && <TrendingUp className="h-3 w-3 text-emerald-600" />}
          {delta.tone === 'negative' && <TrendingDown className="h-3 w-3 text-red-600" />}
          {delta.tone === 'neutral' && <Minus className="h-3 w-3 text-gray-400" />}
          <span
            className={
              delta.tone === 'positive'
                ? 'font-medium text-emerald-600'
                : delta.tone === 'negative'
                  ? 'font-medium text-red-600'
                  : 'text-gray-500'
            }
          >
            {delta.value}
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}
