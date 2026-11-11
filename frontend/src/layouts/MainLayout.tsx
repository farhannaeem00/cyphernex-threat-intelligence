
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import Topbar from '../components/layout/Topbar'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-[#080d18] text-slate-200">
      <Sidebar />

      <div className="min-h-screen pl-64">
        <Topbar />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
