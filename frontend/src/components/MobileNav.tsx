import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, FileText, Calculator } from 'lucide-react';

const items = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Docs', href: '/documents', icon: FileText },
  { name: 'Recons', href: '/reconciliations', icon: Calculator },
];

/**
 * Bottom navigation bar for mobile viewports. Hidden on lg+ screens.
 */
export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white/95 backdrop-blur pb-safe lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => (
        <NavLink
          key={item.name}
          to={item.href}
          end={item.href === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive ? 'text-indigo-600' : 'text-gray-500'
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          {item.name}
        </NavLink>
      ))}
    </nav>
  );
}
