import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ConnectionStatus } from '../components/status/StatusComponents';
import { useMachineConnectionStatus } from '../hooks/useMachineConnectionStatus';

const MenuIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const CloseIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const PanelIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5v14" />
  </svg>
);

const DashboardIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
  </svg>
);

const MachineIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v8H4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8V5h10v3M8 12h.01M16 12h.01M7 16v3M17 16v3" />
  </svg>
);

const ChartIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19V9M12 19V5M19 19v-7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
  </svg>
);

const ReportIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h8l4 4v12H7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 4v4h4M10 12h6M10 16h6" />
  </svg>
);

const SettingsIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
  </svg>
);

export const Sidebar = ({ onLogout, isMobileOpen, onMobileClose, isDesktopCollapsed, onDesktopToggle }) => {
  const location = useLocation();
  const { hasOnlineMachine } = useMachineConnectionStatus();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
    { path: '/machines', label: 'Machines', icon: MachineIcon },
    { path: '/oee', label: 'OEE Analytics', icon: ChartIcon },
    { path: '/reports', label: 'Reports', icon: ReportIcon },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition-opacity duration-300 xl:hidden ${
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onMobileClose}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-800 bg-slate-950/95 shadow-2xl shadow-slate-950/40 transition-all duration-300 ${
          isDesktopCollapsed ? 'xl:w-24' : 'xl:w-72'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } w-72 xl:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'xl:justify-center xl:w-full' : ''}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/30">
              <PanelIcon />
            </div>
            {!isDesktopCollapsed && (
              <div className="xl:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Control Panel</p>
                <h1 className="text-lg font-semibold text-slate-100">OEE Monitor</h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDesktopToggle}
              className="hidden rounded-xl border border-slate-800 p-2 text-slate-400 transition hover:border-slate-700 hover:text-slate-100 xl:inline-flex"
              aria-label="Toggle sidebar"
            >
              <MenuIcon />
            </button>
            <button
              type="button"
              onClick={onMobileClose}
              className="rounded-xl border border-slate-800 p-2 text-slate-400 transition hover:border-slate-700 hover:text-slate-100 xl:hidden"
              aria-label="Close sidebar"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-800 px-5 py-4">
          <div
            className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-3 ${
              isDesktopCollapsed ? 'xl:flex xl:justify-center' : ''
            }`}
          >
            <ConnectionStatus isConnected={hasOnlineMachine} compact={isDesktopCollapsed} />
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                } ${isDesktopCollapsed ? 'xl:justify-center xl:px-2' : ''}`}
                title={isDesktopCollapsed ? item.label : ''}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  <Icon />
                </span>
                {!isDesktopCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={onLogout}
            className={`w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 ${
              isDesktopCollapsed ? 'xl:px-0' : ''
            }`}
          >
            {isDesktopCollapsed ? 'Out' : 'Logout'}
          </button>
        </div>
      </aside>
    </>
  );
};

export const MainLayout = ({ children, onLogout }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsMobileSidebarOpen(false);
      } else {
        setIsDesktopCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Sidebar
        onLogout={onLogout}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onDesktopToggle={() => setIsDesktopCollapsed((prev) => !prev)}
      />

      <main className={`min-h-screen transition-all duration-300 ${isDesktopCollapsed ? 'xl:ml-24' : 'xl:ml-72'}`}>
        <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/85 backdrop-blur xl:hidden">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Control Panel</p>
              <h1 className="text-lg font-semibold text-slate-100">OEE Monitor</h1>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-800 p-2 text-slate-300 transition hover:border-slate-700 hover:text-white"
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
