import { LayoutDashboard, PoundSterling, FileText, TrendingUp, ClipboardCheck, ChevronDown } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
  { to: '/income', label: 'Income', icon: <PoundSterling size={14} /> },
  { to: '/documents', label: 'Documents', icon: <FileText size={14} /> },
  { to: '/shares', label: 'Share Schemes', icon: <TrendingUp size={14} /> },
  { to: '/return', label: 'Tax Return', icon: <ClipboardCheck size={14} /> },
]

interface Props {
  profileName: string
  onProfileClick: () => void
}

export function DesktopNav({ profileName, onProfileClick }: Props) {
  return (
    <nav className="hidden md:flex items-center justify-between px-8 h-14 border-b border-white/[0.06] bg-bg sticky top-0 z-50">
      <div className="font-serif text-[20px] tracking-[-0.02em]">
        Tax<span className="text-accent">Tracker</span>
      </div>
      <div className="flex gap-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-[7px] px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-accent bg-accent-soft'
                  : 'text-text-2 hover:text-text-1 hover:bg-surface-3'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
      <button
        onClick={onProfileClick}
        className="flex items-center gap-2 px-3 py-[5px] rounded-full border border-white/10 text-[13px] font-medium text-text-2 hover:border-accent/30 hover:text-text-1 transition-all"
      >
        <span className="w-[26px] h-[26px] rounded-full bg-accent flex items-center justify-center text-[11px] font-semibold text-bg font-mono">
          {profileName[0].toUpperCase()}
        </span>
        {profileName}
        <ChevronDown size={10} />
      </button>
    </nav>
  )
}
