import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ToastContainer } from '@/shared/components/Toast/Toast'
import { ActionProgressDialog } from '@/shared/components/ActionProgress/ActionProgressDialog'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <TopBar />
      <main
        className={[
          'transition-all duration-300 pt-16',
          collapsed ? 'ml-16' : 'ml-60',
        ].join(' ')}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
      <ActionProgressDialog />
    </div>
  )
}
