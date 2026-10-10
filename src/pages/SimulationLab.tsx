import React from 'react';
import {
  FlaskConical,
  Play,
  Pause,
  RotateCcw,
  Power,
  Zap,
  Cpu,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SimScenario } from '../types/telemetry';
import { SCENARIO_PROFILES } from '../simulation/engine';

const SCENARIOS: SimScenario[] = ['NORMAL', 'HIGH_EXTRACTION', 'POTENTIAL_LEAKAGE', 'HIGH_TURBIDITY', 'RECOVERY', 'RANDOMIZED_TEST'];

const SCENARIO_COLORS: Record<SimScenario, string> = {
  NORMAL: 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10',
  HIGH_EXTRACTION: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10',
  POTENTIAL_LEAKAGE: 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10',
  HIGH_TURBIDITY: 'border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10',
  RECOVERY: 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10',
  RANDOMIZED_TEST: 'border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10',
};

const SCENARIO_ACTIVE: Record<SimScenario, string> = {
  NORMAL: 'border-green-400 bg-green-500/15 ring-1 ring-green-500/30',
  HIGH_EXTRACTION: 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-500/30',
  POTENTIAL_LEAKAGE: 'border-orange-400 bg-orange-500/15 ring-1 ring-orange-500/30',
  HIGH_TURBIDITY: 'border-yellow-400 bg-yellow-500/15 ring-1 ring-yellow-500/30',
  RECOVERY: 'border-blue-400 bg-blue-500/15 ring-1 ring-blue-500/30',
  RANDOMIZED_TEST: 'border-purple-400 bg-purple-500/15 ring-1 ring-purple-500/30',
};

const DEMO_STAGES = ['NORMAL', 'HIGH EXTRACTION', 'POTENTIAL LEAKAGE', 'HIGH TURBIDITY', 'RECOVERY'];

export default function SimulationLab() {
  const {
    simState,
    settings,
    updateSettings,
    startSim,
    pauseSim,
    resetSim,
    setScenario,
    togglePump,
    startDemoSequence,
    cancelDemoSequence,
    currentReading,
  } = useApp();

  const profile = SCENARIO_PROFILES[simState.scenario];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Simulation Lab</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control all simulation parameters and scenarios</p>
      </div>

      {/* Main controls */}
      <div className="card p-4">
        <div className="section-title mb-4">Simulation Controls</div>
        <div className="flex flex-wrap gap-3 items-center">
          {simState.running ? (
            <button onClick={pauseSim} className="btn-warning flex items-center gap-2">
              <Pause className="w-4 h-4" /> Pause Simulation
            </button>
          ) : (
            <button onClick={startSim} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" /> Start Simulation
            </button>
          )}
          <button onClick={resetSim} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset All
          </button>
          <button
            onClick={togglePump}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              simState.pumpOn
                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                : 'bg-gray-500/10 border-gray-500/30 text-gray-400 hover:bg-gray-500/20'
            }`}
          >
            <Power className="w-4 h-4" />
            Pump {simState.pumpOn ? 'ON' : 'OFF'}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <span className={`flex items-center gap-1.5 text-sm font-medium ${simState.running ? 'text-green-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${simState.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              {simState.running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
        </div>

        {/* Current stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Depth', value: `${simState.groundwaterDepthM.toFixed(2)} m`, color: 'text-cyan-300' },
            { label: 'Flow', value: `${simState.flowRateLpm.toFixed(2)} L/min`, color: 'text-green-300' },
            { label: 'Turbidity', value: `${simState.turbidityNTU.toFixed(2)} NTU`, color: 'text-amber-300' },
            { label: 'Extraction', value: `${simState.cumulativeExtractionL.toFixed(1)} L`, color: 'text-blue-300' },
          ].map(s => (
            <div key={s.label} className="card-sm p-3">
              <div className="label mb-1">{s.label}</div>
              <div className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scenario selection */}
      <div className="card p-4">
        <div className="section-title mb-4">Scenario Selection</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIOS.map(s => {
            const p = SCENARIO_PROFILES[s];
            const isActive = simState.scenario === s;
            return (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isActive ? SCENARIO_ACTIVE[s] : SCENARIO_COLORS[s]
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm font-bold text-white mb-1">{p.label}</div>
                  {isActive && <ChevronRight className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">{p.description}</div>
                <div className="mt-3 flex gap-3 text-[10px] text-gray-500">
                  <span>Flow ~{p.targetFlowLpm} L/min</span>
                  <span>Turb ~{p.turbidityBase} NTU</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Demo sequence */}
      <div className="card p-4 border-purple-500/20 bg-purple-500/3">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-purple-400" />
          <div className="section-title">Competition Demo Sequence</div>
        </div>

        {simState.demoRunning ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
              <div>
                <div className="text-sm font-semibold text-purple-300">Demo Sequence Running — Stage {simState.demoStage}/5</div>
                <div className="text-xs text-purple-400/70">Current: {profile.label} — {profile.description}</div>
              </div>
              <button onClick={cancelDemoSequence} className="ml-auto btn-secondary text-xs">Cancel</button>
            </div>
            {/* Stage progress */}
            <div className="grid grid-cols-5 gap-2">
              {DEMO_STAGES.map((stage, i) => (
                <div key={stage} className={`text-center p-2 rounded-lg text-[10px] border ${
                  i + 1 < simState.demoStage ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  i + 1 === simState.demoStage ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' :
                  'bg-white/3 border-gray-700 text-gray-600'
                }`}>
                  <div className="font-bold mb-0.5">{i + 1}</div>
                  <div className="leading-tight">{stage}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Automatically cycles through 5 stages: Normal → High Extraction → Potential Leakage → High Turbidity → Recovery.
              Each stage runs for ~12 seconds to demonstrate the full alert lifecycle.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {DEMO_STAGES.map((stage, i) => (
                <div key={stage} className="text-center p-2 rounded-lg text-[10px] border border-gray-700 bg-white/3 text-gray-500">
                  <div className="font-bold mb-0.5">{i + 1}</div>
                  <div className="leading-tight">{stage}</div>
                </div>
              ))}
            </div>
            <button onClick={startDemoSequence} className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" /> Start Demo Sequence
            </button>
          </div>
        )}
      </div>

      {/* Adjustable parameters */}
      <div className="card p-4">
        <div className="section-title mb-4">Adjustable Parameters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Thresholds */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Alert Thresholds</div>
            {[
              { label: 'Depth Warning (m)', key: 'depthWarningM' as const, min: 5, max: 35, color: 'amber', value: settings.depthWarningM },
              { label: 'Depth Critical (m)', key: 'depthCriticalM' as const, min: 10, max: 40, color: 'red', value: settings.depthCriticalM },
              { label: 'Max Normal Flow (L/min)', key: 'maxNormalFlowLpm' as const, min: 5, max: 80, color: 'green', value: settings.maxNormalFlowLpm },
              { label: 'Turbidity Threshold (NTU)', key: 'turbidityThresholdNTU' as const, min: 1, max: 50, color: 'yellow', value: settings.turbidityThresholdNTU },
            ].map(param => (
              <div key={param.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{param.label}</span>
                  <span className={`font-mono font-bold text-${param.color}-400`}>{param.value}</span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={0.5}
                  value={param.value}
                  onChange={e => updateSettings({ [param.key]: +e.target.value })}
                  className={`w-full accent-${param.color}-500`}
                />
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>{param.min}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Baseline / info */}
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Simulation Info</div>
            <div className="card-sm p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Scenario</span>
                <span className="text-cyan-300">{profile.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Flow</span>
                <span className="text-green-300">{profile.targetFlowLpm} L/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Flow Variance</span>
                <span className="text-green-300">±{profile.flowVariance} L/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Turbidity Base</span>
                <span className="text-amber-300">{profile.turbidityBase} NTU</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pump Status</span>
                <span className={simState.pumpOn ? 'text-green-400' : 'text-gray-500'}>
                  {simState.pumpOn ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Update Interval</span>
                <span className="text-gray-300">{settings.updateIntervalMs} ms</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Update Interval (ms)</span>
                <span className="font-mono text-cyan-400">{settings.updateIntervalMs} ms</span>
              </div>
              <input
                type="range"
                min={500}
                max={5000}
                step={250}
                value={settings.updateIntervalMs}
                onChange={e => updateSettings({ updateIntervalMs: +e.target.value })}
                className="w-full accent-cyan-500"
              />
              <div className="text-[10px] text-gray-600 mt-1">
                Note: interval change takes effect after next Reset + Start
              </div>
            </div>

            <button
              onClick={() => {
                updateSettings({
                  depthWarningM: 18,
                  depthCriticalM: 25,
                  maxNormalFlowLpm: 30,
                  turbidityThresholdNTU: 10,
                  updateIntervalMs: 1500,
                });
              }}
              className="btn-secondary w-full text-xs"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Scenario description */}
      <div className="card p-4 border-cyan-500/15">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <div className="section-title">Current Scenario: {profile.label}</div>
        </div>
        <p className="text-sm text-gray-300">{profile.description}</p>
        <p className="text-xs text-gray-600 mt-2">
          All simulation values are generated by a deterministic engine with controlled noise. No real sensor data is used.
        </p>
      </div>
    </div>
  );
}
