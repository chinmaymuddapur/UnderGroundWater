import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AlertSeverity,
  AppSettings,
  ChartPoint,
  DEFAULT_SETTINGS,
  SimScenario,
  SimulationState,
  TelemetryReading,
} from '../types/telemetry';
import {
  DEFAULT_SIM_CONFIG,
  applyScenario,
  buildReading,
  createInitialSimState,
  resetSimulation,
  tickSimulation,
} from '../simulation/engine';
import { evaluateRules, resetRuleDebounce } from '../simulation/rules';
import {
  HardwareProvider,
  HardwareConnectionState,
} from '../hardware/HardwareProvider';

// ─── Context Shape ─────────────────────────────────────────────────────────────

interface AppContextValue {
  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Simulation control  (unchanged — always available)
  simState: SimulationState;
  startSim: () => void;
  pauseSim: () => void;
  resetSim: () => void;
  setScenario: (s: SimScenario) => void;
  togglePump: () => void;

  // Demo sequence
  startDemoSequence: () => void;
  cancelDemoSequence: () => void;

  // Current telemetry (driven by active mode)
  currentReading: TelemetryReading | null;

  // History for charts
  telemetryHistory: TelemetryReading[];
  chartHistory: ChartPoint[];

  // Alerts
  alerts: Alert[];
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  clearResolvedAlerts: () => void;

  // Hardware connection state (null when in SIMULATION mode)
  hardwareState: HardwareConnectionState | null;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('sas_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem('sas_settings', JSON.stringify(s));
  } catch { /* ignore */ }
}

const MAX_HISTORY = 300;

// Demo sequence timing (ms per stage)
const DEMO_STAGE_DURATION = 12000;
const DEMO_STAGES: SimScenario[] = [
  'NORMAL',
  'HIGH_EXTRACTION',
  'POTENTIAL_LEAKAGE',
  'HIGH_TURBIDITY',
  'RECOVERY',
];

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [simState, setSimState] = useState<SimulationState>(createInitialSimState);
  const [currentReading, setCurrentReading] = useState<TelemetryReading | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [chartHistory, setChartHistory] = useState<ChartPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hardwareState, setHardwareState] = useState<HardwareConnectionState | null>(null);

  // Refs for use inside interval callbacks (avoid stale closures)
  const simStateRef = useRef(simState);
  simStateRef.current = simState;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const telHistRef = useRef(telemetryHistory);
  telHistRef.current = telemetryHistory;

  // ── Interval refs ─────────────────────────────────────────────────────────
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // ── Hardware provider (created once, reused) ──────────────────────────────
  const hwProviderRef = useRef<HardwareProvider | null>(null);

  // ─── Shared reading ingestion (used by both sim and hardware) ─────────────
  const ingestReading = useCallback((reading: TelemetryReading) => {
    setCurrentReading(reading);

    setTelemetryHistory(prev => {
      const updated = [...prev, reading];
      return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
    });

    const cp: ChartPoint = {
      timestamp: reading.timestamp,
      time: formatTime(reading.timestamp),
      groundwaterDepthM: reading.groundwaterDepthM,
      flowRateLpm: reading.flowRateLpm,
      turbidityNTU: reading.turbidityNTU,
    };
    setChartHistory(prev => {
      const updated = [...prev, cp];
      return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
    });

    // Rule evaluation
    const newAlerts = evaluateRules(reading, settingsRef.current, telHistRef.current);
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 200));
    }
  }, []);

  // ─── Simulation tick ──────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const now = Date.now();
    const next = tickSimulation(
      simStateRef.current,
      DEFAULT_SIM_CONFIG,
      settingsRef.current,
      now,
    );
    simStateRef.current = next;
    setSimState(next);
    ingestReading(buildReading(next));
  }, [ingestReading]);

  // ─── Simulation interval management ──────────────────────────────────────
  const startSimInterval = useCallback(() => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(tick, settingsRef.current.updateIntervalMs);
  }, [tick]);

  const stopSimInterval = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }, []);

  // ─── Hardware provider management ─────────────────────────────────────────
  const startHardware = useCallback(() => {
    // Stop simulation timers first — the two sources must not run simultaneously
    stopSimInterval();
    setSimState(prev => ({ ...prev, running: false }));

    if (!hwProviderRef.current) {
      hwProviderRef.current = new HardwareProvider({
        onReading: (reading) => ingestReading(reading),
        onStatus:  (state)   => setHardwareState(state),
        pollIntervalMs: 2000,
      });
    }
    hwProviderRef.current.start();
  }, [stopSimInterval, ingestReading]);

  const stopHardware = useCallback(() => {
    hwProviderRef.current?.stop();
    setHardwareState(null);
  }, []);

  // ─── React to mode changes ────────────────────────────────────────────────
  // When the user toggles between SIMULATION and HARDWARE in Settings,
  // we start/stop the appropriate provider.
  const prevModeRef = useRef(settings.mode);
  useEffect(() => {
    if (settings.mode === prevModeRef.current) return;
    prevModeRef.current = settings.mode;

    if (settings.mode === 'HARDWARE') {
      // Switching TO hardware — stop sim, start hw polling
      stopSimInterval();
      setSimState(prev => ({ ...prev, running: false }));
      // Clear history so simulation data doesn't pollute hardware charts
      setCurrentReading(null);
      setTelemetryHistory([]);
      setChartHistory([]);
      setAlerts([]);
      resetRuleDebounce();
      startHardware();
    } else {
      // Switching TO simulation — stop hw polling
      stopHardware();
    }
  }, [settings.mode, startHardware, stopHardware, stopSimInterval]);

  // ─── Simulation controls ──────────────────────────────────────────────────
  const startSim = useCallback(() => {
    // In HARDWARE mode, simulation must not start
    if (settingsRef.current.mode === 'HARDWARE') return;

    setSimState(prev => {
      const next = { ...prev, running: true, lastTickTime: Date.now() };
      simStateRef.current = next;
      return next;
    });
    startSimInterval();
    setAlerts(prev => [
      {
        id: `SIM_START_${Date.now()}`,
        severity: 'INFO' as AlertSeverity,
        status: 'RESOLVED',
        timestamp: Date.now(),
        resolvedAt: Date.now(),
        title: 'Simulation Started',
        message: 'Simulation engine started. Data labelled SIMULATED.',
        triggeredBy: 'System',
        explanation: 'The simulation engine has been started. All readings are simulated demonstration data.',
        recommendation: 'Observe telemetry and switch scenarios to test alert rules.',
        observedValue: '—',
        metric: 'System',
      },
      ...prev,
    ]);
  }, [startSimInterval]);

  const pauseSim = useCallback(() => {
    setSimState(prev => ({ ...prev, running: false }));
    stopSimInterval();
    setAlerts(prev => [
      {
        id: `SIM_PAUSE_${Date.now()}`,
        severity: 'INFO' as AlertSeverity,
        status: 'RESOLVED',
        timestamp: Date.now(),
        resolvedAt: Date.now(),
        title: 'Simulation Paused',
        message: 'Simulation engine paused.',
        triggeredBy: 'System',
        explanation: 'Telemetry updates are suspended until simulation is resumed.',
        recommendation: 'Click Start to resume.',
        observedValue: '—',
        metric: 'System',
      },
      ...prev,
    ]);
  }, [stopSimInterval]);

  const resetSim = useCallback(() => {
    stopSimInterval();
    cancelDemoSequenceInternal();
    resetRuleDebounce();
    const fresh = resetSimulation(12);
    simStateRef.current = fresh;
    setSimState(fresh);
    setCurrentReading(null);
    setTelemetryHistory([]);
    setChartHistory([]);
    setAlerts([]);
    // Also reset hardware session extraction counter
    hwProviderRef.current?.resetSession();
  }, [stopSimInterval]);

  const setScenario = useCallback((scenario: SimScenario) => {
    setSimState(prev => {
      const next = applyScenario(prev, scenario);
      simStateRef.current = next;
      return next;
    });
    setAlerts(prev => [
      {
        id: `SCENARIO_${Date.now()}`,
        severity: 'INFO' as AlertSeverity,
        status: 'RESOLVED',
        timestamp: Date.now(),
        resolvedAt: Date.now(),
        title: `Scenario Changed: ${scenario.replace('_', ' ')}`,
        message: `Simulation scenario switched to ${scenario.replace(/_/g, ' ')}.`,
        triggeredBy: 'Operator',
        explanation: 'Scenario change applied. Telemetry will transition to new parameters.',
        recommendation: 'Monitor dashboard for changes.',
        observedValue: scenario,
        metric: 'Simulation',
      },
      ...prev,
    ]);
  }, []);

  const togglePump = useCallback(() => {
    setSimState(prev => {
      const next = { ...prev, pumpOn: !prev.pumpOn };
      simStateRef.current = next;
      return next;
    });
  }, []);

  // ─── Demo Sequence ────────────────────────────────────────────────────────
  function cancelDemoSequenceInternal() {
    if (demoTimerRef.current) {
      clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    setSimState(prev => ({ ...prev, demoRunning: false, demoStage: 0 }));
  }

  const cancelDemoSequence = useCallback(() => {
    cancelDemoSequenceInternal();
  }, []);

  const startDemoSequence = useCallback(() => {
    if (settingsRef.current.mode === 'HARDWARE') return; // no demo in HW mode
    if (!simStateRef.current.running) startSim();
    setSimState(prev => ({ ...prev, demoRunning: true, demoStage: 0 }));

    let stage = 0;
    function advance() {
      if (stage >= DEMO_STAGES.length) {
        setSimState(prev => ({ ...prev, demoRunning: false, demoStage: 0 }));
        return;
      }
      const scenario = DEMO_STAGES[stage];
      setScenario(scenario);
      setSimState(prev => ({ ...prev, demoStage: stage + 1 }));
      stage++;
      demoTimerRef.current = setTimeout(advance, DEMO_STAGE_DURATION);
    }
    advance();
  }, [startSim, setScenario]);

  // ─── Alert management ─────────────────────────────────────────────────────
  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts(prev =>
      prev.map(a => a.id === id && a.status === 'ACTIVE' ? { ...a, status: 'ACKNOWLEDGED' } : a),
    );
  }, []);

  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === id && a.status !== 'RESOLVED'
          ? { ...a, status: 'RESOLVED', resolvedAt: Date.now() }
          : a,
      ),
    );
  }, []);

  const clearResolvedAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(a => a.status !== 'RESOLVED'));
  }, []);

  // ─── Settings ─────────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      settingsRef.current = next;
      return next;
    });
  }, []);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopSimInterval();
      stopHardware();
      cancelDemoSequenceInternal();
    };
  }, [stopSimInterval, stopHardware]);

  // ─── Context value ────────────────────────────────────────────────────────
  const value: AppContextValue = {
    settings,
    updateSettings,
    simState,
    startSim,
    pauseSim,
    resetSim,
    setScenario,
    togglePump,
    startDemoSequence,
    cancelDemoSequence,
    currentReading,
    telemetryHistory,
    chartHistory,
    alerts,
    acknowledgeAlert,
    resolveAlert,
    clearResolvedAlerts,
    hardwareState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
