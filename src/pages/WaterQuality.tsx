import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Droplets, Info, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1529] border border-[#1e3a5f] rounded-lg p-3 shadow-xl text-xs">
      <div className="text-gray-400 mb-1.5 font-mono">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>{p.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function WaterQuality() {
  const { chartHistory, settings, updateSettings, simState, currentReading, alerts } = useApp();

  const turb = currentReading?.turbidityNTU ?? simState.turbidityNTU;
  const data = chartHistory.slice(-80);

  const turbStats = useMemo(() => {
    const vals = chartHistory.map(p => p.turbidityNTU);
    if (!vals.length) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      exceedances: vals.filter(v => v > settings.turbidityThresholdNTU).length,
    };
  }, [chartHistory, settings.turbidityThresholdNTU]);

  const turbidityAlerts = alerts.filter(a => a.metric === 'Turbidity');
  const turbStatus = turb > settings.turbidityThresholdNTU * 2 ? 'critical' : turb > settings.turbidityThresholdNTU ? 'warning' : 'normal';

  const turbColor = turbStatus === 'critical' ? 'text-red-400' : turbStatus === 'warning' ? 'text-amber-400' : 'text-green-400';
  const turbBg = turbStatus === 'critical' ? 'bg-red-500/10 border-red-500/30' : turbStatus === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Water Quality Monitoring</h1>
        <p className="text-sm text-gray-500 mt-0.5">Turbidity analysis — simulated demonstration data only</p>
      </div>

      {/* Disclaimer */}
      <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-3 text-xs text-gray-400">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-blue-300">Important:</strong> This dashboard monitors turbidity only, using a configurable demonstration threshold. Turbidity alone does not determine drinking-water safety. No pH, TDS, dissolved oxygen, bacteria, or contaminant measurements are available in this simulation. All readings are simulated values.
        </div>
      </div>

      {/* Current turbidity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`card ${turbBg} p-5 md:col-span-1`}>
          <div className="label mb-3">Current Turbidity</div>
          <div className={`text-5xl font-bold tabular-nums ${turbColor}`}>{turb.toFixed(1)}</div>
          <div className="text-lg text-gray-400 mt-1">NTU</div>
          <div className={`mt-3 text-xs font-medium ${turbColor}`}>
            {turbStatus === 'critical' ? '⚠ ABOVE CRITICAL LEVEL' : turbStatus === 'warning' ? '⚠ ABOVE DEMO THRESHOLD' : '✓ Within demo threshold'}
          </div>
          <div className="text-[10px] text-gray-600 mt-1">SIMULATED — demo threshold only</div>
        </div>

        <div className="card p-4 md:col-span-2 grid grid-cols-2 gap-4">
          <div>
            <div className="label mb-2">Session Min</div>
            <div className="text-2xl font-bold text-green-300 tabular-nums">{turbStats?.min.toFixed(2) ?? '—'}</div>
            <div className="text-xs text-gray-500">NTU</div>
          </div>
          <div>
            <div className="label mb-2">Session Max</div>
            <div className="text-2xl font-bold text-red-300 tabular-nums">{turbStats?.max.toFixed(2) ?? '—'}</div>
            <div className="text-xs text-gray-500">NTU</div>
          </div>
          <div>
            <div className="label mb-2">Session Avg</div>
            <div className="text-2xl font-bold text-amber-300 tabular-nums">{turbStats?.avg.toFixed(2) ?? '—'}</div>
            <div className="text-xs text-gray-500">NTU</div>
          </div>
          <div>
            <div className="label mb-2">Threshold Exceedances</div>
            <div className={`text-2xl font-bold tabular-nums ${(turbStats?.exceedances ?? 0) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {turbStats?.exceedances ?? 0}
            </div>
            <div className="text-xs text-gray-500">readings above {settings.turbidityThresholdNTU} NTU</div>
          </div>
        </div>
      </div>

      {/* Threshold editor */}
      <div className="card p-4">
        <div className="section-title mb-3">Configurable Demonstration Threshold</div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 whitespace-nowrap">Alert threshold (NTU):</label>
            <input
              type="range"
              min={1}
              max={50}
              step={0.5}
              value={settings.turbidityThresholdNTU}
              onChange={e => updateSettings({ turbidityThresholdNTU: +e.target.value })}
              className="w-40 accent-amber-500"
            />
            <span className="text-amber-400 font-mono font-bold w-12">{settings.turbidityThresholdNTU} NTU</span>
          </div>
          <div className="text-xs text-gray-600">
            This is a configurable demonstration value only — not a regulatory or safety limit.
          </div>
        </div>
      </div>

      {/* Turbidity chart */}
      <div className="card p-4">
        <div className="section-title mb-4">Turbidity History</div>
        {data.length < 2 ? (
          <div className="flex items-center justify-center text-gray-600 text-sm h-52">Start simulation to record turbidity history</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="turbGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={settings.turbidityThresholdNTU} stroke="#f59e0b" strokeDasharray="4,4" strokeWidth={1.5} label={{ value: `Demo threshold: ${settings.turbidityThresholdNTU} NTU`, fill: '#f59e0b', fontSize: 9 }} />
              <Area
                type="monotone"
                dataKey="turbidityNTU"
                name="Turbidity (NTU)"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#turbGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quality event history */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div className="section-title">Quality Event History</div>
        </div>
        {turbidityAlerts.length === 0 ? (
          <div className="text-sm text-gray-600 py-4 text-center">No turbidity events recorded yet</div>
        ) : (
          <div className="space-y-2">
            {turbidityAlerts.slice(0, 10).map(alert => (
              <div key={alert.id} className={`text-xs p-3 rounded-lg border ${
                alert.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' :
                'bg-amber-500/5 border-amber-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-semibold ${alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>
                    {alert.title}
                  </span>
                  <span className="text-gray-600 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString('en-GB')}
                  </span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                    alert.status === 'RESOLVED' ? 'bg-green-500/10 text-green-500' :
                    alert.status === 'ACKNOWLEDGED' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{alert.status}</span>
                </div>
                <div className="text-gray-400">{alert.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Turbidity explainer */}
      <div className="card p-4">
        <div className="section-title mb-3">About Turbidity</div>
        <div className="text-sm text-gray-400 space-y-2">
          <p>
            <strong className="text-gray-300">Turbidity</strong> is a measure of water clarity, expressed in NTU (Nephelometric Turbidity Units).
            Higher turbidity indicates more suspended particles, which can reduce light penetration and may indicate sediment disturbance, algal growth, or other quality events.
          </p>
          <p>
            <strong className="text-gray-300">This dashboard uses a configurable demonstration threshold</strong>, not a regulatory or drinking-water safety standard.
            Real-world water quality assessment requires certified laboratory testing and evaluation against applicable standards (e.g., WHO guidelines, national regulations).
          </p>
          <p className="text-gray-600 text-xs">
            No pH, TDS, dissolved oxygen, heavy metals, bacteria, or other parameters are measured in this simulation.
          </p>
        </div>
      </div>
    </div>
  );
}
