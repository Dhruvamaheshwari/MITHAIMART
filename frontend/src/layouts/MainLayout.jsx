import { Outlet } from 'react-router-dom'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-brand-gold/40 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
          <span className="font-display text-2xl font-semibold text-brand-red">MithaiMart</span>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
