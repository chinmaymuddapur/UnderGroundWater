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
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
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
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function GroundwaterAnalysis() {
  const { chartHistory, settings, simState, currentReading } = useApp();

  const data = chartHistory.slice(-80);
  const depth = currentReading?.groundwaterDepthM ?? simState.groundwaterDepthM;

  const stats = useMemo(() => {
    const depths = chartHistory.map(p => p.groundwaterDepthM ?? 0).filter(Boolean);
    if (depths.length === 0) return null;
    return {
      min: Math.min(...depths),
      max: Math.max(...depths),
      avg: depths.reduce((a, b) => a + b, 0) / depths.length,
      current: depth,
      trend: depths.length >= 5
        ? depths[depths.length - 1] > depths[depths.length - 5] ? 'RISING_DEPTH' : 'FALLING_DEPTH'
        : 'STABLE',
    };
  }, [chartHistory, depth]);

  // Extraction vs recovery data (bucket by 10 readings)
  const exVsRec = useMemo(() => {
    const buckets: { time: string; extraction: number; recovery: number }[] = [];
    for (let i = 0; i < chartHistory.length - 10; i += 10) {
      const slice = chartHistory.slice(i, i + 10);
      const avgFlow = slice.reduce((s, p) => s + p.flowRateLpm, 0) / slice.length;
      const depthChange = (slice[slice.length - 1].groundwaterDepthM ?? 0) - (slice[0].groundwaterDepthM ?? 0);
      buckets.push({
        time: slice[0].time,
        extraction: Math.max(0, avgFlow),
        recovery: Math.max(0, -depthChange * 50), // scaled for visibility
      });
    }
    return buckets;
  }, [chartHistory]);

  const trendIcon = stats?.trend === 'RISING_DEPTH'
    ? <TrendingUp className="w-4 h-4 text-red-400" />
    : stats?.trend === 'FALLING_DEPTH'
    ? <TrendingDown className="w-4 h-4 text-green-400" />
    : <Minus className="w-4 h-4 text-gray-400" />;

  const aquiferStatus = !stats ? 'Insufficient data' :
    depth >= settings.depthCriticalM ? 'Critically low (simulated)' :
    depth >= settings.depthWarningM  ? 'Below warning threshold (simulated)' :
    depth < settings.depthWarningM * 0.7 ? 'Recovering (simulated)' :
    'Within normal range (simulated)';

  const aquiferStatusColor = !stats ? 'text-gray-500' :
    depth >= settings.depthCriticalM ? 'text-red-400' :
    depth >= settings.depthWarningM  ? 'text-amber-400' :
    'text-green-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Groundwater Analysis</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Inferred from simulated data and simplified rules — not a calibrated hydrogeological model
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Depth', value: depth.toFixed(2), unit: 'm', color: 'text-cyan-300' },
          { label: 'Session Min', value: stats?.min.toFixed(2) ?? '—', unit: 'm', color: 'text-green-300' },
          { label: 'Session Max', value: stats?.max.toFixed(2) ?? '—', unit: 'm', color: 'text-red-300' },
          { label: 'Session Avg', value: stats?.avg.toFixed(2) ?? '—', unit: 'm', color: 'text-amber-300' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="label mb-2">{s.label}</div>
            <div className={`text-3xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.unit} below ground</div>
          </div>
        ))}
      </div>

      {/* Aquifer status */}
      <div className="card p-4">
        <div className="section-title mb-3">Estimated Aquifer Status</div>
        <div className="flex items-center gap-4">
          {trendIcon}
          <div>
            <div className={`text-lg font-bold ${aquiferStatusColor}`}>{aquiferStatus}</div>
            <div className="text-xs text-gray-500 mt-1">
              Based on simulated depth ({depth.toFixed(1)} m) relative to configured thresholds
              (warning: {settings.depthWarningM} m, critical: {settings.depthCriticalM} m).
              This is inferred from demonstration data only.
            </div>
          </div>
        </div>
        {/* Depth bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>5 m (min)</span>
            <span>{settings.depthWarningM} m (warn)</span>
            <span>{settings.depthCriticalM} m (crit)</span>
            <span>40 m (max)</span>
          </div>
          <div className="relative h-4 bg-[#111d35] rounded-full overflow-hidden border border-[#1e3a5f]">
            {/* Warning zone */}
            <div
              className="absolute top-0 h-full bg-amber-500/20"
              style={{ left: `${((settings.depthWarningM - 5) / 35) * 100}%`, width: `${((settings.depthCriticalM - settings.depthWarningM) / 35) * 100}%` }}
            />
            {/* Critical zone */}
            <div
              className="absolute top-0 h-full bg-red-500/20"
              style={{ left: `${((settings.depthCriticalM - 5) / 35) * 100}%`, right: 0 }}
            />
            {/* Current marker */}
            <div
              className="absolute top-0.5 bottom-0.5 w-2 bg-cyan-400 rounded-full transition-all duration-700"
              style={{ left: `calc(${Math.min(99, ((depth - 5) / 35) * 100)}% - 4px)` }}
            />
          </div>
        </div>

        <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-2 text-xs text-gray-400">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          Increasing depth values indicate a falling water table in this model. The aquifer zone is represented conceptually — actual behaviour depends on local hydrogeology.
        </div>
      </div>

      {/* Depth history chart */}
      <div className="card p-4">
        <div className="section-title mb-4">Groundwater Depth History</div>
        {data.length < 2 ? (
          <div className="flex items-center justify-center text-gray-600 text-sm h-52">
            Start simulation to record depth history
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="depthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} width={36} reversed />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={settings.depthWarningM} stroke="#f59e0b" strokeDasharray="4,4" strokeWidth={1} label={{ value: `Warn ${settings.depthWarningM}m`, fill: '#f59e0b', fontSize: 9 }} />
              <ReferenceLine y={settings.depthCriticalM} stroke="#ef4444" strokeDasharray="4,4" strokeWidth={1} label={{ value: `Crit ${settings.depthCriticalM}m`, fill: '#ef4444', fontSize: 9 }} />
              <Area
                type="monotone"
                dataKey="groundwaterDepthM"
                name="Depth (m)"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#depthGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="text-xs text-gray-600 mt-2 text-center">Y-axis inverted — higher values = deeper water table</div>
      </div>

      {/* Extraction vs Recovery */}
      <div className="card p-4">
        <div className="section-title mb-1">Extraction vs Recovery Pattern</div>
        <div className="text-xs text-gray-500 mb-4">Bucketed over 10-reading windows. Recovery value scaled for comparison.</div>
        {exVsRec.length < 2 ? (
          <div className="flex items-center justify-center text-gray-600 text-sm h-40">
            Not enough data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={exVsRec} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} width={32} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              <Bar dataKey="extraction" name="Avg Flow (L/min)" fill="#22d3ee" fillOpacity={0.7} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="recovery" name="Recovery Index" fill="#34d399" fillOpacity={0.7} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Plain language summary */}
      <div className="card p-4">
        <div className="section-title mb-3">Trend Summary</div>
        <div className="text-sm text-gray-300 space-y-2">
          {!stats ? (
            <p className="text-gray-600">Start simulation to generate analysis data.</p>
          ) : (
            <>
              <p>
                The simulated water table is currently at <strong className="text-cyan-300">{depth.toFixed(1)} m</strong> below the ground reference point.
                {depth >= settings.depthCriticalM && <span className="text-red-400"> This exceeds the critical threshold and warrants immediate attention in a real scenario.</span>}
                {depth >= settings.depthWarningM && depth < settings.depthCriticalM && <span className="text-amber-400"> This is above the warning threshold.</span>}
                {depth < settings.depthWarningM && <span className="text-green-400"> This is within the normal operating range.</span>}
              </p>
              <p className="text-gray-500">
                Session range: <span className="text-white">{stats.min.toFixed(1)} m</span> to <span className="text-white">{stats.max.toFixed(1)} m</span>
                , average <span className="text-white">{stats.avg.toFixed(1)} m</span> over {chartHistory.length} recorded readings.
              </p>
              <p className="text-gray-600 text-xs">
                Note: All values are simulated demonstration data. Aquifer status is inferred from simplified rules and does not represent a calibrated prediction of real groundwater behaviour.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
