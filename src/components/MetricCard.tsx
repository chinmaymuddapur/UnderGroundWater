import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export type MetricStatus = 'normal' | 'warning' | 'critical' | 'offline' | 'simulated';

interface MetricCardProps {
  title: string;
  value: string | number | null;
  unit: string;
  icon: React.ReactNode;
  status: MetricStatus;
  trend?: 'up' | 'down' | 'stable';
  trendLabel?: string;
  subLabel?: string;
  badge?: string;
  footer?: string;
  className?: string;
}

const STATUS_STYLES: Record<MetricStatus, { border: string; glow: string; dot: string; label: string; labelColor: string }> = {
  normal:    { border: 'border-green-500/30',  glow: 'glow-green',  dot: 'bg-green-400',  label: 'NORMAL',    labelColor: 'text-green-400' },
  warning:   { border: 'border-amber-500/40',  glow: 'glow-amber',  dot: 'bg-amber-400',  label: 'WARNING',   labelColor: 'text-amber-400' },
  critical:  { border: 'border-red-500/40',    glow: 'glow-red',    dot: 'bg-red-400',    label: 'CRITICAL',  labelColor: 'text-red-400'   },
  offline:   { border: 'border-gray-600/40',   glow: '',            dot: 'bg-gray-500',   label: 'OFFLINE',   labelColor: 'text-gray-500'  },
  simulated: { border: 'border-cyan-500/30',   glow: 'glow-cyan',   dot: 'bg-cyan-400',   label: 'SIMULATED', labelColor: 'text-cyan-400'  },
};

const VALUE_COLORS: Record<MetricStatus, string> = {
  normal:    'text-green-300',
  warning:   'text-amber-300',
  critical:  'text-red-300',
  offline:   'text-gray-500',
  simulated: 'text-cyan-300',
};

export default function MetricCard({
  title,
  value,
  unit,
  icon,
  status,
  trend,
  trendLabel,
  subLabel,
  badge,
  footer,
  className = '',
}: MetricCardProps) {
  const style = STATUS_STYLES[status];

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-gray-500';

  const StatusIcon =
    status === 'critical' ? XCircle :
    status === 'warning'  ? AlertTriangle :
    status === 'offline'  ? XCircle :
                            CheckCircle;

  return (
    <div
      className={`card ${style.border} ${style.glow} p-4 flex flex-col gap-3 relative overflow-hidden ${className}`}
    >
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${
        status === 'critical' ? 'bg-red-500/60' :
        status === 'warning'  ? 'bg-amber-500/60' :
        status === 'normal'   ? 'bg-green-500/40' :
                                'bg-cyan-500/40'
      }`} />

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="label mb-1">{title}</div>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-mono">
              {badge}
            </span>
          )}
        </div>
        <div className={`p-2 rounded-lg ${
          status === 'critical' ? 'bg-red-500/10 text-red-400' :
          status === 'warning'  ? 'bg-amber-500/10 text-amber-400' :
          status === 'normal'   ? 'bg-green-500/10 text-green-400' :
                                  'bg-cyan-500/10 text-cyan-400'
        }`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold tabular-nums leading-none ${VALUE_COLORS[status]}`}>
          {value !== null && value !== undefined ? value : '—'}
        </span>
        <span className="text-sm text-gray-400 mb-0.5">{unit}</span>
        {trend && (
          <TrendIcon className={`w-4 h-4 mb-0.5 ml-auto ${trendColor}`} />
        )}
      </div>

      {/* Sub label */}
      {subLabel && (
        <div className="text-xs text-gray-500">{subLabel}</div>
      )}

      {/* Trend label */}
      {trendLabel && (
        <div className={`text-xs flex items-center gap-1 ${trendColor}`}>
          {trend && <TrendIcon className="w-3 h-3" />}
          {trendLabel}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className={`status-dot ${style.dot}`} />
          <span className={`text-[10px] font-medium ${style.labelColor}`}>{style.label}</span>
        </div>
        {footer && <div className="text-[10px] text-gray-600">{footer}</div>}
      </div>
    </div>
  );
}
