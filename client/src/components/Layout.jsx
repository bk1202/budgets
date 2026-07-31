import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', icon: 'ri-dashboard-line', label: 'Home' },
  { path: '/transactions', icon: 'ri-exchange-line', label: 'Transactions' },
  { path: '/budgets', icon: 'ri-wallet-line', label: 'Budgets' },
  { path: '/analytics', icon: 'ri-pie-chart-line', label: 'Analytics' },
  { path: '/settings', icon: 'ri-settings-line', label: 'Settings' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#141418] border-r border-[#2a2a35] p-6 fixed h-screen z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <i className="ri-funds-line text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">FreeBudget</h1>
            <p className="text-xs text-[#5b5b6e]">Smart spending</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-[#8b8b9e] hover:text-white hover:bg-[#1a1a20]'
                }`
              }
            >
              <i className={`${item.icon} text-lg`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-[#2a2a35]">
          <div className="text-xs text-[#5b5b6e] mb-1">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="text-2xl font-bold text-white">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pb-24 md:pb-0">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-[#2a2a35] bg-[#141418] sticky top-0 z-30">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {navItems.find(i => {
                if (i.path === '/') return location.pathname === '/'
                return location.pathname.startsWith(i.path)
              })?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              U
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav flex items-center justify-around md:hidden">
        {navItems.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-indigo-400' : 'text-[#8b8b9e]'
              }`}
            >
              <i className={`${item.icon} text-xl`}></i>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
