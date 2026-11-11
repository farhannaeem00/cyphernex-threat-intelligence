
import { Bell, Search } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#080d18]/95 px-8 backdrop-blur">
      <div>
        <p className="text-xs text-slate-500">Security Operations / Workspace</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Threat Intelligence Center
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 md:flex">
          <Search size={16} className="text-slate-500" />
          <span className="text-xs text-slate-500">Intelligence workspace</span>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg border border-slate-800 p-2.5 text-slate-400 hover:bg-slate-800"
        >
          <Bell size={18} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/20 bg-teal-400/10 text-sm font-semibold text-teal-300">
          CN
        </div>
      </div>
    </header>
  )
}
