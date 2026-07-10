import { LayoutDashboard, PoundSterling, FileText, TrendingUp, ClipboardCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/income', label: 'Income', icon: PoundSterling },
  { to: '/documents', label: 'Docs', icon: FileText },
  { to: '/shares', label: 'Shares', icon: TrendingUp },
  { to: '/return', label: 'Return', icon: ClipboardCheck },
]

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-white/[0.06] z-50">
      <div className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-[3px] py-3 text-[8px] transition-colors ${
                isActive ? 'text-accent' : 'text-text-3'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
