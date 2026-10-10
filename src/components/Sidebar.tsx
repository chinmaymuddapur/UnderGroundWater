import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  TrendingDown,
  Droplets,
  Bell,
  FlaskConical,
  FileText,
  Settings,
  Waves,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/monitoring', icon: Activity, label: 'Live Monitoring' },
  { to: '/groundwater', icon: TrendingDown, label: 'GW Analysis' },
  { to: '/quality', icon: Droplets, label: 'Water Quality' },
  { to: '/alerts', icon: Bell, label: 'Alerts & Events' },
  { to: '/simulation', icon: FlaskConical, label: 'Simulation Lab' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { alerts } = useApp();
  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE').length;
  const criticalAlerts = alerts.filter(a => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length;

  return (
    <aside
      className={`flex flex-col h-full bg-[#0d1529] border-r border-[#1e3a5f] transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-[#1e3a5f] ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
          <Waves className="w-4 h-4 text-cyan-400" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-xs font-bold text-cyan-400 leading-tight">SMART AQUIFER</div>
            <div className="text-[10px] text-gray-500 leading-tight">SENTINEL</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isAlerts = to === '/alerts';
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-4 h-4" />
                {isAlerts && activeAlerts > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${
                      criticalAlerts > 0 ? 'bg-red-500' : 'bg-amber-500'
                    } text-white`}
                  >
                    {activeAlerts > 9 ? '9+' : activeAlerts}
                  </span>
                )}
              </div>
              {!collapsed && <span>{label}</span>}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1e3a5f] text-gray-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-[#2a4f7c]">
                  {label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom version tag */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#1e3a5f]">
          <div className="text-[10px] text-gray-600">v1.0.0 — Demo Build</div>
          <div className="text-[10px] text-gray-600">Competition Prototype</div>
        </div>
      )}
    </aside>
  );
}
