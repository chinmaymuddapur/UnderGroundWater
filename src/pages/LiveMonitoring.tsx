import React, { useState } from 'react';
import { Activity, Settings2, Play, Pause } from 'lucide-react';
import TelemetryChart from '../components/TelemetryChart';
import { useApp } from '../context/AppContext';

export default function LiveMonitoring() {
  const { simState, currentReading, settings, updateSettings, startSim, pauseSim, telemetryHistory } = useApp();
  const [showThresholds, setShowThresholds] = useState(false);

  const r = currentReading;
  const last20 = telemetryHistory.slice(-20).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Live Monitoring</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time telemetry — all values simulated demonstration data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThresholds(v => !v)}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" /> Thresholds
          </button>
          {simState.running ? (
            <button onClick={pauseSim} className="btn-warning flex items-center gap-2">
              <Pause className="w-4 h-4" /> Pause
            </button>
          ) : (
            <button onClick={startSim} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" /> Start
            </button>
          )}
        </div>
      </div>

      {/* Threshold editor */}
      {showThresholds && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label mb-1 block">Depth Warning (m)</label>
            <input
              type="number"
              className="w-full bg-[#111d35] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-sm text-amber-300 focus:outline-none focus:border-amber-500"
              value={settings.depthWarningM}
              onChange={e => updateSettings({ depthWarningM: +e.target.value })}
            />
          </div>
          <div>
            <label className="label mb-1 block">Depth Critical (m)</label>
            <input
              type="number"
              className="w-full bg-[#111d35] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-sm text-red-300 focus:outline-none focus:border-red-500"
              value={settings.depthCriticalM}
              onChange={e => updateSettings({ depthCriticalM: +e.target.value })}
            />
          </div>
          <div>
            <label className="label mb-1 block">Max Flow (L/min)</label>
            <input
              type="number"
              className="w-full bg-[#111d35] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-sm text-green-300 focus:outline-none focus:border-green-500"
              value={settings.maxNormalFlowLpm}
              onChange={e => updateSettings({ maxNormalFlowLpm: +e.target.value })}
            />
          </div>
          <div>
            <label className="label mb-1 block">Turbidity Threshold (NTU)</label>
            <input
              type="number"
              className="w-full bg-[#111d35] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-sm text-amber-300 focus:outline-none focus:border-amber-500"
              value={settings.turbidityThresholdNTU}
              onChange={e => updateSettings({ turbidityThresholdNTU: +e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Current readings */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Groundwater Depth', value: r?.groundwaterDepthM?.toFixed(2) ?? '—', unit: 'm', color: 'text-cyan-300', status: 'SIMULATED' },
          { label: 'Flow Rate', value: r?.flowRateLpm.toFixed(2) ?? '—', unit: 'L/min', color: 'text-green-300', status: 'SIMULATED' },
          { label: 'Turbidity', value: r?.turbidityNTU.toFixed(2) ?? '—', unit: 'NTU', color: 'text-amber-300', status: 'SIMULATED' },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <div className="label mb-2">{item.label}</div>
            <div className={`text-4xl font-bold tabular-nums ${item.color}`}>{item.value}</div>
            <div className="text-sm text-gray-500 mt-1">{item.unit}</div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] text-cyan-500">{item.status}</span>
              {simState.running && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-2" />}
            </div>
          </div>
        ))}
      </div>

      {/* Large chart */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div className="section-title">Telemetry Time Series</div>
          {simState.running && (
            <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <TelemetryChart height={320} showControls={true} />
      </div>

      {/* Sensor status table */}
      <div className="card p-4">
        <div className="section-title mb-3">Sensor Status</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f]">
                <th className="text-left label py-2 pr-4">Sensor</th>
                <th className="text-left label py-2 pr-4">Metric</th>
                <th className="text-left label py-2 pr-4">Status</th>
                <th className="text-left label py-2 pr-4">Source</th>
                <th className="text-right label py-2">Last Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Water Level Sensor', metric: 'Groundwater Depth', status: 'SIMULATED', source: 'Simulation Engine', value: `${r?.groundwaterDepthM?.toFixed(2) ?? '—'} m` },
                { name: 'Flow Meter', metric: 'Flow Rate', status: 'SIMULATED', source: 'Simulation Engine', value: `${r?.flowRateLpm.toFixed(2) ?? '—'} L/min` },
                { name: 'Turbidity Sensor', metric: 'Turbidity', status: 'SIMULATED', source: 'Simulation Engine', value: `${r?.turbidityNTU.toFixed(2) ?? '—'} NTU` },
                { name: 'Ultrasonic Sensor', metric: 'Groundwater Depth', status: 'NOT CONNECTED', source: 'Hardware (unavailable)', value: '—' },
              ].map(row => (
                <tr key={row.name} className="border-b border-[#0f1e38] hover:bg-white/2 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-300">{row.name}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{row.metric}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      row.status === 'SIMULATED' ? 'bg-cyan-500/15 text-cyan-400' :
                      row.status === 'NOT CONNECTED' ? 'bg-gray-500/15 text-gray-500' :
                      'bg-green-500/15 text-green-400'
                    }`}>{row.status}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">{row.source}</td>
                  <td className="py-2.5 text-right font-mono text-gray-300">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latest readings table */}
      <div className="card p-4">
        <div className="section-title mb-3">Recent Telemetry Log</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e3a5f]">
                <th className="text-left label py-2 pr-3">Timestamp</th>
                <th className="text-right label py-2 pr-3">Depth (m)</th>
                <th className="text-right label py-2 pr-3">Flow (L/min)</th>
                <th className="text-right label py-2 pr-3">Turbidity (NTU)</th>
                <th className="text-right label py-2 pr-3">Pump</th>
                <th className="text-right label py-2">Extraction (L)</th>
              </tr>
            </thead>
            <tbody>
              {last20.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-gray-600">No data — start simulation</td></tr>
              ) : (
                last20.map((reading, i) => (
                  <tr key={reading.timestamp} className={`border-b border-[#0f1e38] ${i === 0 ? 'bg-cyan-500/5' : ''}`}>
                    <td className="py-1.5 pr-3 text-gray-500">
                      {new Date(reading.timestamp).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-cyan-300">{reading.groundwaterDepthM?.toFixed(2) ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-green-300">{reading.flowRateLpm.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right text-amber-300">{reading.turbidityNTU.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <span className={reading.pumpOn ? 'text-green-400' : 'text-gray-500'}>
                        {reading.pumpOn ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-gray-400">{reading.cumulativeExtractionL.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
