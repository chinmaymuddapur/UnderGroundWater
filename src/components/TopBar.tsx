import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Wifi,
  WifiOff,
  Menu,
  ChevronDown,
  Cpu,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SimScenario } from '../types/telemetry';
import { SCENARIO_PROFILES } from '../simulation/engine';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const {
    settings,
    updateSettings,
    simState,
    startSim,
    pauseSim,
    resetSim,
    setScenario,
    currentReading,
    alerts,
    hardwareState,
  } = useApp();

  const [now, setNow] = useState(new Date());
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'WARNING').length;

  const systemStatus = criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : simState.running ? 'NORMAL' : 'STANDBY';
  const statusColors = {
    CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30',
    WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    NORMAL: 'text-green-400 bg-green-500/10 border-green-500/30',
    STANDBY: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };
  const dotColors = {
    CRITICAL: 'bg-red-400 animate-pulse',
    WARNING: 'bg-amber-400 animate-pulse',
    NORMAL: 'bg-green-400',
    STANDBY: 'bg-gray-500',
  };

  const SCENARIOS: SimScenario[] = ['NORMAL', 'HIGH_EXTRACTION', 'POTENTIAL_LEAKAGE', 'HIGH_TURBIDITY', 'RECOVERY', 'RANDOMIZED_TEST'];

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-[#0d1529] border-b border-[#1e3a5f] h-14 flex-shrink-0">
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Title */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-sm font-bold text-white hidden sm:block">Smart Aquifer Sentinel</span>
        <span className="text-xs text-gray-500 hidden md:block">|</span>
        <span className="text-xs text-gray-500 hidden md:block">Groundwater Management System</span>
      </div>

      {/* DEMO label */}
      {settings.mode === 'SIMULATION' && (
        <div className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold tracking-wider hidden sm:block">
          DEMO DATA
        </div>
      )}

      {/* Hardware mode badge */}
      {settings.mode === 'HARDWARE' && (
        <div className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider items-center gap-1 hidden sm:flex ${
          hardwareState?.connected
            ? 'bg-green-500/15 border-green-500/30 text-green-400'
            : 'bg-orange-500/15 border-orange-500/30 text-orange-400'
        }`}>
          {hardwareState?.connected
            ? <><Wifi className="w-3 h-3" /> HARDWARE CONNECTED</>
            : <><WifiOff className="w-3 h-3" /> NOT CONNECTED</>
          }
        </div>
      )}

      {/* System status */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${statusColors[systemStatus]}`}>
        <span className={`status-dot ${dotColors[systemStatus]}`} />
        <span className="hidden sm:inline">{systemStatus}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Scenario Selector */}
      <div className="relative hidden lg:block">
        <button
          onClick={() => setScenarioOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111d35] border border-[#1e3a5f] hover:border-cyan-700 text-xs text-gray-300 transition-colors"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-500" />
          <span>{SCENARIO_PROFILES[simState.scenario].label}</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>
        {scenarioOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-[#111d35] border border-[#1e3a5f] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
            {SCENARIOS.map(s => (
              <button
                key={s}
                onClick={() => { setScenario(s); setScenarioOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  simState.scenario === s
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {SCENARIO_PROFILES[s].label}
              </button>
            ))}
          </div>
        )}
        {scenarioOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setScenarioOpen(false)} />
        )}
      </div>

      {/* Mode toggle */}
      <button
        onClick={() => updateSettings({ mode: settings.mode === 'SIMULATION' ? 'HARDWARE' : 'SIMULATION' })}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-[#111d35] border border-[#1e3a5f] hover:border-cyan-700 text-gray-400 transition-colors hidden md:flex"
      >
        {settings.mode === 'SIMULATION' ? (
          <><Cpu className="w-3.5 h-3.5 text-cyan-500" /><span>SIM</span></>
        ) : (
          <><Wifi className="w-3.5 h-3.5 text-orange-400" /><span>HW</span></>
        )}
      </button>

      {/* Simulation controls */}
      <div className="flex items-center gap-1.5">
        {!simState.running ? (
          <button
            onClick={startSim}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start</span>
          </button>
        ) : (
          <button
            onClick={pauseSim}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}
        <button
          onClick={resetSim}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#2a4f7c] text-gray-300 text-xs font-medium transition-colors border border-[#2a4f7c]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Clock */}
      <div className="text-xs text-gray-400 font-mono tabular-nums hidden lg:block">
        {now.toLocaleTimeString('en-GB')}
      </div>

      {/* Last update */}
      {currentReading && (
        <div className="text-[10px] text-gray-600 hidden xl:block tabular-nums">
          Updated {new Date(currentReading.timestamp).toLocaleTimeString('en-GB')}
        </div>
      )}
    </header>
  );
}
