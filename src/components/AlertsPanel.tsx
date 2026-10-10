import React, { useState } from 'react';
import {
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { Alert, AlertSeverity, AlertStatus } from '../types/telemetry';
import { useApp } from '../context/AppContext';

interface Props {
  maxItems?: number;
  compact?: boolean;
}

const SEVERITY_STYLES: Record<AlertSeverity, { icon: React.ElementType; border: string; bg: string; text: string; badge: string }> = {
  CRITICAL: { icon: XCircle,       border: 'border-red-500/30',    bg: 'bg-red-500/5',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-400' },
  WARNING:  { icon: AlertTriangle, border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  text: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-400' },
  INFO:     { icon: Info,          border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-400' },
};

const STATUS_STYLES: Record<AlertStatus, string> = {
  ACTIVE:       'text-white',
  ACKNOWLEDGED: 'text-gray-400',
  RESOLVED:     'text-gray-600',
};

function AlertRow({ alert, compact }: { alert: Alert; compact: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { acknowledgeAlert, resolveAlert } = useApp();
  const sty = SEVERITY_STYLES[alert.severity];
  const Icon = sty.icon;
  const isResolved = alert.status === 'RESOLVED';

  return (
    <div className={`border rounded-lg overflow-hidden transition-opacity ${sty.border} ${sty.bg} ${isResolved ? 'opacity-50' : ''}`}>
      <button
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
        onClick={() => setExpanded(v => !v)}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sty.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${STATUS_STYLES[alert.status]}`}>
              {alert.title}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sty.badge}`}>
              {alert.severity}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              alert.status === 'ACTIVE' ? 'bg-white/10 text-gray-300' :
              alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-green-500/10 text-green-500'
            }`}>
              {alert.status}
            </span>
          </div>
          {!compact && (
            <div className="text-[11px] text-gray-400 mt-0.5 truncate">{alert.message}</div>
          )}
          <div className="text-[10px] text-gray-600 mt-0.5 font-mono">
            {new Date(alert.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {alert.resolvedAt && ` → ${new Date(alert.resolvedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-600">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-gray-500">Rule: </span>
              <span className="text-gray-300">{alert.triggeredBy}</span>
            </div>
            <div>
              <span className="text-gray-500">Metric: </span>
              <span className="text-gray-300">{alert.metric}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Observed: </span>
              <span className={`font-mono font-semibold ${sty.text}`}>{alert.observedValue}</span>
            </div>
          </div>
          <div className="text-xs text-gray-400 bg-black/20 rounded p-2">
            <div className="font-medium text-gray-300 mb-1">Explanation</div>
            {alert.explanation}
          </div>
          <div className="text-xs text-gray-400 bg-black/20 rounded p-2">
            <div className="font-medium text-gray-300 mb-1">Recommendation</div>
            {alert.recommendation}
          </div>
          {!isResolved && (
            <div className="flex gap-2 pt-1">
              {alert.status === 'ACTIVE' && (
                <button
                  onClick={(e) => { e.stopPropagation(); acknowledgeAlert(alert.id); }}
                  className="text-xs px-3 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id); }}
                className="text-xs px-3 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
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

export default function AlertsPanel({ maxItems = 10, compact = false }: Props) {
  const { alerts, clearResolvedAlerts } = useApp();
  const displayed = alerts.slice(0, maxItems);
  const resolvedCount = alerts.filter(a => a.status === 'RESOLVED').length;
  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              {activeCount} Active
            </span>
          )}
          {resolvedCount > 0 && (
            <span className="text-xs text-gray-600">{resolvedCount} resolved</span>
          )}
          {alerts.length === 0 && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> No alerts
            </span>
          )}
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={clearResolvedAlerts}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Resolved
          </button>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-1.5">
        {displayed.length === 0 ? (
          <div className="text-sm text-gray-600 py-6 text-center">
            No events recorded. Start simulation to generate telemetry.
          </div>
        ) : (
          displayed.map(alert => (
            <AlertRow key={alert.id} alert={alert} compact={compact} />
          ))
        )}
      </div>

      {alerts.length > maxItems && (
        <div className="text-xs text-gray-600 text-center pt-1">
          + {alerts.length - maxItems} more — view Alerts page for full history
        </div>
      )}
    </div>
  );
}
