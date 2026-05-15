import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard, Package, Zap, User, ChevronRight,
  Shield, Star, TrendingUp, Bell, Menu, X, Activity,
  LogOut, Settings, Layers, Radio
} from 'lucide-react';

const navItems = [
  { to: '/home', icon: LayoutDashboard, label: 'Command Center', desc: 'Overview' },
  { to: '/sender/post', icon: Package, label: 'Post Request', desc: 'Sender' },
  { to: '/runner/feed', icon: Zap, label: 'Job Feed', desc: 'Runner' },
  { to: '/runner/active', icon: Radio, label: 'Active Delivery', desc: 'Live ops' },
  { to: '/profile', icon: User, label: 'Profile', desc: 'Account' },
];

export function AppShell() {
  const { user, currentRole } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const roleColor = currentRole === 'sender'
    ? 'text-violet-400 bg-violet-400/10 border-violet-400/30'
    : currentRole === 'runner'
      ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30'
      : 'text-slate-400 bg-slate-400/10 border-slate-400/30';

  const roleDot = currentRole === 'sender' ? 'bg-violet-400' : currentRole === 'runner' ? 'bg-cyan-400' : 'bg-slate-500';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060A14', fontFamily: 'Inter, sans-serif' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-[220px]'}
        `}
        style={{ background: '#080C18', borderRight: '1px solid #1A2535' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1A2535' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>RB</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm tracking-wide">RushBuddy</span>
            <span className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>v1.0 · BETA</span>
          </div>
          <button className="ml-auto md:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Role indicator */}
        {user && (
          <div className="px-4 py-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium ${roleColor}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${roleDot} animate-pulse`} />
              {currentRole
                ? `${currentRole.charAt(0).toUpperCase() + currentRole.slice(1)} Mode`
                : 'Select Role'}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, desc }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group
                ${isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
                }`
              }
              style={({ isActive }) => isActive
                ? { background: '#111E35', borderLeft: '2px solid #06B6D4', paddingLeft: '10px' }
                : {}
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-400'} />
                  <div className="flex flex-col">
                    <span className="leading-none">{label}</span>
                    <span className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{desc}</span>
                  </div>
                  {isActive && <ChevronRight size={12} className="ml-auto text-cyan-400/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System status */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid #1A2535' }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>SYSTEM NOMINAL</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: '#0D1525' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)', color: 'white' }}>
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs text-white truncate">{user?.name || 'Aditi Krishnan'}</span>
              <span className="text-[10px] truncate" style={{ color: '#475569' }}>{user?.hostelBlock || 'MH-C Block'}</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-3 px-4 md:px-6 py-3 flex-shrink-0"
          style={{ background: '#070B17', borderBottom: '1px solid #1A2535' }}>
          <button
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <Layers size={11} className="text-cyan-400" />
            <span style={{ color: '#475569' }}>rushbuddy</span>
            <span style={{ color: '#1E2D45' }}>/</span>
            <span className="text-slate-300">
              {location.pathname.replace('/', '').replace('/', ' / ') || 'auth'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: '#0D1A10', border: '1px solid #1A3520' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>LIVE</span>
            </div>

            {/* Notifications */}
            <button className="relative text-slate-400 hover:text-white transition-colors">
              <Bell size={16} />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" />
            </button>

            {/* Trust score */}
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                <Shield size={11} className="text-cyan-400" />
                <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {user.trustScore}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden flex items-center z-30"
        style={{ background: '#080C18', borderTop: '1px solid #1A2535' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors
              ${isActive ? 'text-cyan-400' : 'text-slate-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-cyan-400' : ''} />
                <span>{label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
