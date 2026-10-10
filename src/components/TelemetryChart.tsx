import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartPoint } from '../types/telemetry';
import { useApp } from '../context/AppContext';

type Series = 'depth' | 'flow' | 'turbidity';

interface Props {
  height?: number;
  showControls?: boolean;
  defaultSeries?: Series[];
}

const SERIES_CONFIG: Record<Series, { key: keyof ChartPoint; label: string; color: string; unit: string; yAxisId: string }> = {
  depth:     { key: 'groundwaterDepthM', label: 'GW Depth (m)',   color: '#22d3ee', unit: 'm',     yAxisId: 'left'  },
  flow:      { key: 'flowRateLpm',       label: 'Flow (L/min)',   color: '#34d399', unit: 'L/min', yAxisId: 'right' },
  turbidity: { key: 'turbidityNTU',      label: 'Turbidity (NTU)',color: '#f59e0b', unit: 'NTU',   yAxisId: 'right' },
};

interface TooltipPayload {
  dataKey: string;
  color: string;
  value: number;
  name: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1529] border border-[#1e3a5f] rounded-lg p-3 shadow-xl text-xs">
      <div className="text-gray-400 mb-2 font-mono">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
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

export default function TelemetryChart({
  height = 280,
  showControls = true,
  defaultSeries = ['depth', 'flow', 'turbidity'],
}: Props) {
  const { chartHistory, settings, simState } = useApp();
  const [activeSeries, setActiveSeries] = useState<Set<Series>>(new Set(defaultSeries));

  const toggleSeries = (s: Series) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(s)) { if (next.size > 1) next.delete(s); }
      else next.add(s);
      return next;
    });
  };

  // Show last 60 points
  const data = chartHistory.slice(-60);

  const tickFormatter = (v: string) => v;

  return (
    <div className="flex flex-col gap-3">
      {showControls && (
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SERIES_CONFIG) as [Series, typeof SERIES_CONFIG[Series]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                activeSeries.has(key)
                  ? 'border-opacity-60 text-white'
                  : 'border-gray-700 text-gray-600 opacity-50'
              }`}
              style={activeSeries.has(key) ? { borderColor: cfg.color, color: cfg.color, background: `${cfg.color}18` } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: activeSeries.has(key) ? cfg.color : '#4b5563' }} />
              {cfg.label}
            </button>
          ))}
          <span className="text-xs text-gray-600 self-center ml-auto">
            {data.length} pts
          </span>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height }}>
          No telemetry data — start simulation to record data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1e3a5f' }}
              interval="preserveStartEnd"
              tickFormatter={tickFormatter}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1e3a5f' }}
              width={36}
              label={{ value: 'm', fill: '#4b5563', fontSize: 9, position: 'insideTopLeft', offset: 4 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1e3a5f' }}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />

            {/* Threshold reference lines */}
            {activeSeries.has('depth') && (
              <>
                <ReferenceLine yAxisId="left" y={settings.depthWarningM} stroke="#f59e0b" strokeDasharray="4,4" strokeWidth={1} label={{ value: 'Warn', fill: '#f59e0b', fontSize: 9 }} />
                <ReferenceLine yAxisId="left" y={settings.depthCriticalM} stroke="#ef4444" strokeDasharray="4,4" strokeWidth={1} label={{ value: 'Crit', fill: '#ef4444', fontSize: 9 }} />
              </>
            )}
            {activeSeries.has('turbidity') && (
              <ReferenceLine yAxisId="right" y={settings.turbidityThresholdNTU} stroke="#f59e0b" strokeDasharray="4,4" strokeWidth={1} />
            )}

            {activeSeries.has('depth') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={SERIES_CONFIG.depth.key}
                name={SERIES_CONFIG.depth.label}
                stroke={SERIES_CONFIG.depth.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
            {activeSeries.has('flow') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={SERIES_CONFIG.flow.key}
                name={SERIES_CONFIG.flow.label}
                stroke={SERIES_CONFIG.flow.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
            {activeSeries.has('turbidity') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={SERIES_CONFIG.turbidity.key}
                name={SERIES_CONFIG.turbidity.label}
                stroke={SERIES_CONFIG.turbidity.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
