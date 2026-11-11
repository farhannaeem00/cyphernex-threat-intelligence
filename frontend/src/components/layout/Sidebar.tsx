
import { NavLink } from 'react-router-dom'
import {
  Activity,
  LayoutDashboard,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  Crosshair,
  FileUp,
} from 'lucide-react'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Investigations', path: '/investigations', icon: Crosshair },
  { label: 'Threat Graph', path: '/graph', icon: Network },
  { label: 'Intelligence Search', path: '/intelligence', icon: Search },
  { label: 'Documents', path: '/documents', icon: FileUp },
  { label: 'Risk Analysis', path: '/risks', icon: ShieldAlert },
]

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800 bg-[#0b1220]">
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/10">
          <ShieldCheck size={23} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide text-white">
            Cypher<span className="text-teal-400">Nex</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[2px] text-slate-500">
            Threat Intelligence
          </p>
        </div>
      </div>

      <div className="px-4 pt-8">
        <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[2px] text-slate-500">
          Workspace
        </p>

        <nav className="space-y-1">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                  isActive
                    ? 'border border-teal-400/10 bg-teal-400/10 font-medium text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-800 p-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity size={15} className="text-teal-400" />
          Intelligence platform
        </div>
        <p className="mt-2 text-[10px] text-slate-600">CypherNex v1.0</p>
      </div>
    </aside>
  )
}
