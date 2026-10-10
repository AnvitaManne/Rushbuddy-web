import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { services } from '@/services';
import {
  LayoutDashboard, Package, Zap, User, Shield, Radio,
  Menu, X, LogOut,
} from 'lucide-react';
import { RushMark } from '../brand/BrandMark';

const navItems = [
  { to: '/home', icon: LayoutDashboard, label: 'Home', desc: 'Overview' },
  { to: '/sender/post', icon: Package, label: 'Post Request', desc: 'Sender' },
  { to: '/runner/feed', icon: Zap, label: 'Job Feed', desc: 'Runner' },
  { to: '/runner/active', icon: Radio, label: 'Active Delivery', desc: 'Live job' },
  { to: '/ops', icon: Shield, label: 'Ops Queue', desc: 'Disputes / holds' },
  { to: '/profile', icon: User, label: 'Profile', desc: 'Account' },
];

export function AppShell() {
  const {
    user,
    currentRole,
    isAuthenticated,
    setUser,
    setIsAuthenticated,
    setPendingSignup,
    setPendingEmail,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    try {
      await services.auth.signOut();
    } catch (err) {
      console.warn('[RushBuddy] signOut failed', err);
    }
    setUser(null);
    setIsAuthenticated(false);
    setPendingSignup(null);
    setPendingEmail('');
    navigate('/');
  };

  const roleLabel = currentRole
    ? currentRole === 'sender' ? 'Sender' : 'Runner'
    : 'Select role';

  return (
    <div className="rb-app flex h-screen overflow-hidden" style={{ background: 'var(--rb-paper)' }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0B2340]/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative z-50 h-full flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-[220px]'}
        `}
        style={{ background: '#111315' }}
      >
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <RushMark size={36} />
          <div className="flex flex-col min-w-0">
            <span className="rb-display text-white text-[15px] font-semibold leading-none">RushBuddy</span>
            <span className="text-[10px] mt-1 tracking-wide uppercase" style={{ color: '#7BA3C4' }}>VIT beta</span>
          </div>
          <button className="ml-auto md:hidden text-white/70" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {user && (
          <div className="px-3 py-3">
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#E8EEF4',
                borderRadius: 8,
              }}
            >
              {roleLabel}
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, desc }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                ${isActive ? 'text-white' : 'text-white/65 hover:text-white'}`
              }
              style={({ isActive }) => isActive
                ? { background: 'rgba(255,255,255,0.08)', borderRadius: 8 }
                : { borderRadius: 8 }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} color={isActive ? '#E8A04A' : '#7BA3C4'} />
                  <div className="flex flex-col">
                    <span className="leading-none">{label}</span>
                    <span className="text-[10px] mt-0.5 opacity-60">{desc}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 px-1 py-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: '#C44536', color: '#fff' }}
            >
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs text-white truncate">{user?.name || 'Aditi Krishnan'}</span>
              <span className="text-[10px] truncate" style={{ color: '#7BA3C4' }}>{user?.hostel_block || 'MH-C Block'}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="text-white/50 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="rb-banner flex items-center gap-3 px-4 md:px-6 py-3.5 flex-shrink-0">
          <button
            className="md:hidden text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="text-xs text-white/80 font-medium">
            {location.pathname.replace(/^\//, '').replace(/\//g, ' / ') || 'home'}
          </div>

          <div className="ml-auto">
            {user && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 font-medium"
                style={{ background: 'rgba(11,35,64,0.55)', color: '#F3F2EF', borderRadius: 999 }}
              >
                Trust {user.trust_score}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto rb-main-stage">
          <Outlet />
        </main>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 md:hidden flex items-center z-30"
        style={{ background: '#111315', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px]
              ${isActive ? 'text-[#E8A04A]' : 'text-white/55'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} color={isActive ? '#E8A04A' : '#7BA3C4'} />
                <span>{label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
