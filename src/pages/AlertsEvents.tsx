import React, { useState, useMemo } from 'react';
import {
  Bell,
  XCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { Alert, AlertSeverity, AlertStatus } from '../types/telemetry';
import { useApp } from '../context/AppContext';

const SEV_CONFIG = {
  CRITICAL: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    badge: 'bg-red-500/20 text-red-300' },
  WARNING:  { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  badge: 'bg-amber-500/20 text-amber-300' },
  INFO:     { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   badge: 'bg-blue-500/20 text-blue-300' },
};

function AlertDetailRow({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const { acknowledgeAlert, resolveAlert } = useApp();
  const cfg = SEV_CONFIG[alert.severity];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border overflow-hidden ${cfg.border} ${alert.status === 'RESOLVED' ? 'opacity-60' : ''}`}>
      <button
        className={`w-full text-left p-3 ${cfg.bg} flex items-start gap-3 hover:brightness-110 transition-all`}
        onClick={() => setExpanded(v => !v)}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{alert.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${cfg.badge}`}>{alert.severity}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              alert.status === 'ACTIVE' ? 'bg-white/10 text-gray-200' :
              alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-500/15 text-yellow-400' :
              'bg-green-500/15 text-green-500'
            }`}>{alert.status}</span>
            <span className="text-xs text-gray-500 font-mono ml-auto">
              {new Date(alert.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">{alert.message}</div>
        </div>
        <div className="text-gray-600 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-white/5 space-y-3 bg-black/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="card-sm p-2">
              <div className="text-gray-500 mb-1">Rule</div>
              <div className="text-gray-200">{alert.triggeredBy}</div>
            </div>
            <div className="card-sm p-2">
              <div className="text-gray-500 mb-1">Metric</div>
              <div className="text-gray-200">{alert.metric}</div>
            </div>
            <div className="card-sm p-2">
              <div className="text-gray-500 mb-1">Observed Value</div>
              <div className={`font-mono font-bold ${cfg.color}`}>{alert.observedValue}</div>
            </div>
            {alert.resolvedAt && (
              <div className="card-sm p-2">
                <div className="text-gray-500 mb-1">Resolved At</div>
                <div className="text-gray-200 font-mono">{new Date(alert.resolvedAt).toLocaleTimeString('en-GB')}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="card-sm p-3">
              <div className="text-gray-300 font-medium mb-1.5">Explanation</div>
              <div className="text-gray-400 leading-relaxed">{alert.explanation}</div>
            </div>
            <div className="card-sm p-3">
              <div className="text-gray-300 font-medium mb-1.5">Recommended Action</div>
              <div className="text-gray-400 leading-relaxed">{alert.recommendation}</div>
            </div>
          </div>

          {alert.status !== 'RESOLVED' && (
            <div className="flex gap-2">
              {alert.status === 'ACTIVE' && (
                <button
                  onClick={(e) => { e.stopPropagation(); acknowledgeAlert(alert.id); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
              >
                Mark Resolved
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertsEvents() {
  const { alerts, clearResolvedAlerts } = useApp();
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<AlertStatus | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
      return true;
    });
  }, [alerts, filterSeverity, filterStatus]);

  const counts = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length,
    warning: alerts.filter(a => a.severity === 'WARNING' && a.status === 'ACTIVE').length,
    info: alerts.filter(a => a.severity === 'INFO').length,
    resolved: alerts.filter(a => a.status === 'RESOLVED').length,
  }), [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Alerts & Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">{alerts.length} total events recorded this session</p>
        </div>
        {counts.resolved > 0 && (
          <button onClick={clearResolvedAlerts} className="btn-secondary flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Clear Resolved ({counts.resolved})
          </button>
        )}
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Critical', count: counts.critical, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Active Warnings', count: counts.warning, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Info Events', count: counts.info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Resolved', count: counts.resolved, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(item => (
          <div key={item.label} className={`card ${item.bg} p-4`}>
            <div className="label mb-2">{item.label}</div>
            <div className={`text-3xl font-bold tabular-nums ${item.color}`}>{item.count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex gap-1.5">
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterSeverity === s
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex gap-1.5">
          {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterStatus === s
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600 ml-auto">{filtered.length} shown</span>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <Bell className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <div className="text-gray-500 text-sm">No events match the current filter</div>
            {alerts.length === 0 && (
              <div className="text-gray-600 text-xs mt-1">Start simulation and activate scenarios to generate events</div>
            )}
          </div>
        ) : (
          filtered.map(alert => (
            <AlertDetailRow key={alert.id} alert={alert} />
          ))
        )}
      </div>
    </div>
  );
}
