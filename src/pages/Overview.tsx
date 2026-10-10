import React from 'react';
import {
  Waves,
  Gauge,
  Droplets,
  FlaskConical,
  Activity,
  Power,
  Play,
  Cpu,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import MetricCard, { MetricStatus } from '../components/MetricCard';
import AquiferVisualization from '../components/AquiferVisualization';
import TelemetryChart from '../components/TelemetryChart';
import AlertsPanel from '../components/AlertsPanel';
import { useApp } from '../context/AppContext';
import { SCENARIO_PROFILES } from '../simulation/engine';

function getDepthStatus(depth: number, warnM: number, critM: number): MetricStatus {
  if (depth >= critM) return 'critical';
  if (depth >= warnM) return 'warning';
  return 'normal';
}

function getFlowStatus(flow: number, maxFlow: number): MetricStatus {
  if (flow > maxFlow * 1.2) return 'critical';
  if (flow > maxFlow) return 'warning';
  return 'normal';
}

function getTurbStatus(turb: number, threshold: number): MetricStatus {
  if (turb > threshold * 2) return 'critical';
  if (turb > threshold) return 'warning';
  return 'normal';
}

export default function Overview() {
  const {
    simState,
    currentReading,
    settings,
    alerts,
    startSim,
    startDemoSequence,
    cancelDemoSequence,
    chartHistory,
    hardwareState,
  } = useApp();

  const r = currentReading;
  const isHardware = settings.mode === 'HARDWARE';

  const depth = r?.groundwaterDepthM ?? (isHardware ? null : simState.groundwaterDepthM);
  const flow = r?.flowRateLpm ?? (isHardware ? 0 : simState.flowRateLpm);
  const turb = r?.turbidityNTU ?? (isHardware ? 0 : simState.turbidityNTU);
  const extraction = r?.cumulativeExtractionL ?? (isHardware ? 0 : simState.cumulativeExtractionL);

  const depthStatus = depth !== null ? getDepthStatus(depth, settings.depthWarningM, settings.depthCriticalM) : 'offline';
  const flowStatus = getFlowStatus(flow, settings.maxNormalFlowLpm);
  const turbStatus = getTurbStatus(turb, settings.turbidityThresholdNTU);

  // Compute trend from last few chart points
  const last = chartHistory.slice(-6);
  const depthTrend = (last.length >= 2 && depth !== null)
    ? (last[last.length - 1].groundwaterDepthM ?? 0) > (last[0].groundwaterDepthM ?? 0) ? 'up' : 'down'
    : 'stable' as const;
  const flowTrend = last.length >= 2
    ? last[last.length - 1].flowRateLpm > last[0].flowRateLpm ? 'up' : 'down'
    : 'stable' as const;

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL');
  const profile = SCENARIO_PROFILES[simState.scenario];

  const systemStatusLabel =
    criticalAlerts.length > 0 ? 'CRITICAL' :
    activeAlerts.filter(a => a.severity === 'WARNING').length > 0 ? 'WARNING' :
    simState.running ? 'NORMAL' : 'STANDBY';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Command Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Groundwater monitoring dashboard — {settings.mode === 'SIMULATION' ? 'Simulation mode active' : 'Hardware mode — not connected'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
            systemStatusLabel === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            systemStatusLabel === 'WARNING'  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
            systemStatusLabel === 'NORMAL'   ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                               'bg-gray-500/10 border-gray-500/30 text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              systemStatusLabel === 'CRITICAL' ? 'bg-red-400 animate-pulse' :
              systemStatusLabel === 'WARNING'  ? 'bg-amber-400 animate-pulse' :
              systemStatusLabel === 'NORMAL'   ? 'bg-green-400' : 'bg-gray-500'
            }`} />
            SYSTEM: {systemStatusLabel}
          </div>
          {simState.demoRunning && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              Demo Stage {simState.demoStage}/5: {profile.label}
              <button onClick={cancelDemoSequence} className="ml-1 hover:text-purple-200 transition-colors">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Not running banner — simulation mode only */}
      {!simState.running && !isHardware && (
        <div className="card border-cyan-500/30 bg-cyan-500/5 p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Play className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-cyan-300">Simulation not running</div>
            <div className="text-xs text-gray-400 mt-0.5">Start the simulation to begin recording telemetry and generating alerts.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={startSim} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" /> Start Simulation
            </button>
            <button onClick={startDemoSequence} className="btn-secondary flex items-center gap-2">
              <Zap className="w-4 h-4" /> Run Demo Sequence
            </button>
          </div>
        </div>
      )}

      {/* Hardware mode status banner */}
      {isHardware && (
        <div className={`card p-4 flex items-center gap-4 ${
          hardwareState?.connected
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-orange-500/30 bg-orange-500/5'
        }`}>
          <div className={`p-2 rounded-lg ${hardwareState?.connected ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
            {hardwareState?.connected
              ? <Wifi className="w-5 h-5 text-green-400" />
              : <WifiOff className="w-5 h-5 text-orange-400" />
            }
          </div>
          <div className="flex-1">
            <div className={`text-sm font-semibold ${hardwareState?.connected ? 'text-green-300' : 'text-orange-300'}`}>
              {hardwareState?.connected ? 'ESP32 Connected — Receiving Real Sensor Data' : 'Hardware Not Connected'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {hardwareState?.connected
                ? 'Flow and turbidity readings are from physical sensors. Groundwater depth is UNAVAILABLE (no depth sensor). Source: REAL HARDWARE.'
                : hardwareState?.error
                  ? hardwareState.error + ' — start the backend with "npm run server".'
                  : 'Waiting for ESP32 readings. Make sure backend is running and ESP32 is powered.'
              }
            </div>
          </div>
          {hardwareState?.lastSeenAt && (
            <div className="text-xs text-gray-500 font-mono flex-shrink-0">
              Last: {new Date(hardwareState.lastSeenAt).toLocaleTimeString('en-GB')}
            </div>
          )}
        </div>
      )}

      {/* Active scenario info — simulation mode only */}
      {simState.running && !isHardware && (
        <div className="card-sm p-3 flex items-center gap-3">
          <Cpu className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-400">Active Scenario: </span>
            <span className="text-xs font-semibold text-cyan-300">{profile.label}</span>
            <span className="text-xs text-gray-500 ml-2">— {profile.description}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Power className={`w-4 h-4 ${simState.pumpOn ? 'text-green-400' : 'text-gray-500'}`} />
            <span className={`text-xs font-mono ${simState.pumpOn ? 'text-green-400' : 'text-gray-500'}`}>
              Pump {simState.pumpOn ? 'ON' : 'OFF'}
            </span>
          </div>
          {!simState.demoRunning && (
            <button onClick={startDemoSequence} className="btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0">
              <Zap className="w-3.5 h-3.5" /> Run Demo
            </button>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Groundwater Depth"
          value={depth !== null ? depth.toFixed(1) : 'N/A'}
          unit={depth !== null ? 'm' : ''}
          icon={<Waves className="w-5 h-5" />}
          status={isHardware ? 'offline' : (simState.running ? depthStatus : 'simulated')}
          trend={depth !== null ? depthTrend : undefined}
          trendLabel={depth !== null
            ? (depthTrend === 'up' ? 'Table dropping' : depthTrend === 'down' ? 'Table rising' : 'Stable')
            : undefined
          }
          subLabel={isHardware ? 'UNAVAILABLE — no depth sensor' : 'Depth below ground reference'}
          badge={isHardware ? undefined : 'SIMULATED'}
          footer={isHardware ? 'Hardware mode' : `Warn: ${settings.depthWarningM}m`}
        />
        <MetricCard
          title="Flow Rate"
          value={isHardware && !hardwareState?.connected ? 'N/A' : flow.toFixed(1)}
          unit={isHardware && !hardwareState?.connected ? '' : 'L/min'}
          icon={<Gauge className="w-5 h-5" />}
          status={isHardware
            ? (hardwareState?.connected ? flowStatus : 'offline')
            : (simState.running ? flowStatus : 'simulated')
          }
          trend={flowTrend}
          trendLabel={`Max normal: ${settings.maxNormalFlowLpm} L/min`}
          subLabel={isHardware
            ? (hardwareState?.connected ? 'REAL HARDWARE — flow sensor' : 'Waiting for hardware')
            : (simState.pumpOn ? 'Pump active' : 'Pump OFF')
          }
          footer={`Max: ${settings.maxNormalFlowLpm} L/min`}
        />
        <MetricCard
          title="Turbidity"
          value={isHardware && !hardwareState?.connected ? 'N/A' : turb.toFixed(1)}
          unit={isHardware && !hardwareState?.connected ? '' : 'NTU'}
          icon={<Droplets className="w-5 h-5" />}
          status={isHardware
            ? (hardwareState?.connected ? turbStatus : 'offline')
            : (simState.running ? turbStatus : 'simulated')
          }
          subLabel={isHardware
            ? (hardwareState?.connected ? 'REAL HARDWARE — turbidity sensor (approx NTU)' : 'Waiting for hardware')
            : 'Demo threshold only — not a safety limit'
          }
          footer={`Threshold: ${settings.turbidityThresholdNTU} NTU`}
        />
        <MetricCard
          title="Session Extraction"
          value={extraction >= 1000 ? (extraction / 1000).toFixed(2) : extraction.toFixed(0)}
          unit={extraction >= 1000 ? 'kL' : 'L'}
          icon={<FlaskConical className="w-5 h-5" />}
          status={isHardware
            ? (hardwareState?.connected ? 'normal' : 'offline')
            : (simState.running ? 'normal' : 'simulated')
          }
          subLabel={isHardware ? 'Calculated from hardware flow rate' : 'Cumulative this session'}
          footer={isHardware
            ? (hardwareState?.connected ? 'Accumulating' : 'Not connected')
            : (simState.pumpOn ? 'Accumulating' : 'Paused (pump off)')
          }
        />
      </div>

      {/* Main content: visualization + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Aquifer visualization */}
        <div className="card p-4 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="section-title">Aquifer Cross-Section</div>
              <div className="text-xs text-gray-500 mt-0.5">Conceptual visualization — not a surveyed cross-section</div>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {depth !== null ? `${depth.toFixed(1)} m depth` : 'Depth: UNAVAILABLE'}
            </div>
          </div>
          <AquiferVisualization
            depthM={depth ?? simState.groundwaterDepthM}
            flowRateLpm={flow}
            pumpOn={isHardware ? (r?.pumpOn ?? false) : simState.pumpOn}
            isSimulated={!isHardware}
          />
        </div>

        {/* Alerts panel */}
        <div className="card p-4 xl:col-span-2 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div className="section-title">Recent Alerts & Events</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <AlertsPanel maxItems={8} compact={true} />
          </div>
        </div>
      </div>

      {/* Telemetry Chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="section-title">Live Telemetry</div>
            <div className="text-xs text-gray-500 mt-0.5">Last 60 readings — all values simulated demonstration data</div>
          </div>
          {simState.running && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">LIVE</span>
            </div>
          )}
        </div>
        <TelemetryChart height={240} />
      </div>

      {/* Explainable insights */}
      <div className="card p-4">
        <div className="section-title mb-3">Explainable Insights</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="card-sm p-3">
            <div className="text-cyan-400 font-semibold mb-1">Depth Rule</div>
            <div className="text-gray-400">
              Alert triggers when simulated depth ≥ <span className="text-amber-400 font-mono">{settings.depthWarningM}m</span> (warning) or ≥ <span className="text-red-400 font-mono">{settings.depthCriticalM}m</span> (critical). Depth increases under high extraction, recovers at low/zero flow.
            </div>
          </div>
          <div className="card-sm p-3">
            <div className="text-green-400 font-semibold mb-1">Flow Rule</div>
            <div className="text-gray-400">
              Alert triggers when flow rate exceeds <span className="text-amber-400 font-mono">{settings.maxNormalFlowLpm} L/min</span>. Leakage pattern detected when sustained high flow + high variance over 10 readings.
            </div>
          </div>
          <div className="card-sm p-3">
            <div className="text-amber-400 font-semibold mb-1">Turbidity Rule</div>
            <div className="text-gray-400">
              Alert triggers when turbidity exceeds <span className="text-amber-400 font-mono">{settings.turbidityThresholdNTU} NTU</span> (configurable demo threshold). This does not determine water safety — consult applicable standards.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
