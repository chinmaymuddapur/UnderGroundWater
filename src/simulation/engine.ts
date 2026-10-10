import {
  SimulationState,
  SimScenario,
  SimulationConfig,
  TelemetryReading,
  AppSettings,
} from '../types/telemetry';

// ─── Default Config ───────────────────────────────────────────────────────────

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  updateIntervalMs: 1500,
  baselineDepthM: 12.0,
  extractionSensitivity: 0.003,  // depth increase per L/min per tick
  recoveryRateM: 0.008,          // metres recovered per tick
  noiseAmplitude: 0.08,
  maxDepthM: 40,
  minDepthM: 5,
};

// ─── Initial State ────────────────────────────────────────────────────────────

export function createInitialSimState(): SimulationState {
  const now = Date.now();
  return {
    running: false,
    scenario: 'NORMAL',
    pumpOn: true,
    groundwaterDepthM: 12.0,
    flowRateLpm: 18.0,
    turbidityNTU: 3.2,
    cumulativeExtractionL: 0,
    sessionStartTime: now,
    lastTickTime: now,
    demoStage: 0,
    demoRunning: false,
  };
}

// ─── Scenario Profiles ────────────────────────────────────────────────────────

export interface ScenarioProfile {
  targetFlowLpm: number;
  flowVariance: number;
  turbidityBase: number;
  turbidityVariance: number;
  description: string;
  label: string;
}

export const SCENARIO_PROFILES: Record<SimScenario, ScenarioProfile> = {
  NORMAL: {
    targetFlowLpm: 18,
    flowVariance: 2,
    turbidityBase: 3.2,
    turbidityVariance: 0.5,
    label: 'Normal Conditions',
    description: 'Stable baseline operation. Flow and turbidity within normal ranges.',
  },
  HIGH_EXTRACTION: {
    targetFlowLpm: 42,
    flowVariance: 3,
    turbidityBase: 4.5,
    turbidityVariance: 0.8,
    label: 'High Extraction',
    description: 'Elevated extraction rate. Simulated groundwater depth increases over time.',
  },
  POTENTIAL_LEAKAGE: {
    targetFlowLpm: 38,
    flowVariance: 8,
    turbidityBase: 6.0,
    turbidityVariance: 2.0,
    label: 'Potential Leakage',
    description: 'Irregular flow pattern detected. Possible pipe anomaly under investigation.',
  },
  HIGH_TURBIDITY: {
    targetFlowLpm: 20,
    flowVariance: 2,
    turbidityBase: 18.5,
    turbidityVariance: 3,
    label: 'High Turbidity',
    description: 'Turbidity above configured demonstration threshold. Quality event triggered.',
  },
  RECOVERY: {
    targetFlowLpm: 5,
    flowVariance: 1,
    turbidityBase: 2.8,
    turbidityVariance: 0.3,
    label: 'Recovery',
    description: 'Reduced extraction. Water table recovering toward baseline depth.',
  },
  RANDOMIZED_TEST: {
    targetFlowLpm: 25,
    flowVariance: 12,
    turbidityBase: 7,
    turbidityVariance: 5,
    label: 'Randomized Test',
    description: 'Random variation across all parameters. Used for stress-testing alert rules.',
  },
};

// ─── Noise Utilities ──────────────────────────────────────────────────────────

function noise(amplitude: number): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

// ─── Tick Function ────────────────────────────────────────────────────────────

export function tickSimulation(
  state: SimulationState,
  config: SimulationConfig,
  settings: AppSettings,
  nowMs: number,
): SimulationState {
  if (!state.running) return state;

  const dtSeconds = Math.min((nowMs - state.lastTickTime) / 1000, 5); // cap at 5s
  const profile = SCENARIO_PROFILES[state.scenario];

  // ── Flow Rate ──────────────────────────────────────────────────
  const flowNoise = noise(profile.flowVariance);
  const targetFlow = state.pumpOn ? profile.targetFlowLpm : 0;
  const newFlow = clamp(
    lerp(state.flowRateLpm, targetFlow + flowNoise, 0.15),
    0,
    80,
  );

  // ── Turbidity ──────────────────────────────────────────────────
  const turbNoise = noise(profile.turbidityVariance * 0.5);
  const newTurb = clamp(
    lerp(state.turbidityNTU, profile.turbidityBase + turbNoise, 0.12),
    0.5,
    100,
  );

  // ── Groundwater Depth ──────────────────────────────────────────
  let depthDelta = 0;
  if (state.pumpOn && newFlow > 5) {
    // Extraction raises depth (water table drops)
    depthDelta = newFlow * config.extractionSensitivity * dtSeconds;
  } else {
    // Recovery lowers depth (water table rises)
    depthDelta = -config.recoveryRateM * dtSeconds;
  }
  depthDelta += noise(config.noiseAmplitude * 0.5);

  const newDepth = clamp(
    state.groundwaterDepthM + depthDelta,
    config.minDepthM,
    config.maxDepthM,
  );

  // ── Cumulative Extraction ──────────────────────────────────────
  // Only accumulate when pump is on
  const addedLitres = state.pumpOn ? (newFlow * dtSeconds) / 60 : 0;
  const newExtraction = state.cumulativeExtractionL + addedLitres;

  return {
    ...state,
    flowRateLpm: newFlow,
    turbidityNTU: newTurb,
    groundwaterDepthM: newDepth,
    cumulativeExtractionL: newExtraction,
    lastTickTime: nowMs,
  };
}

// ─── Apply Scenario ───────────────────────────────────────────────────────────

export function applyScenario(
  state: SimulationState,
  scenario: SimScenario,
): SimulationState {
  return {
    ...state,
    scenario,
    demoRunning: false,
    demoStage: 0,
  };
}

// ─── Build TelemetryReading from SimState ─────────────────────────────────────

export function buildReading(state: SimulationState): TelemetryReading {
  return {
    timestamp: Date.now(),
    groundwaterDepthM: state.groundwaterDepthM,
    flowRateLpm: state.flowRateLpm,
    turbidityNTU: state.turbidityNTU,
    pumpOn: state.pumpOn,
    cumulativeExtractionL: state.cumulativeExtractionL,
    source: 'SIMULATED',
    sensorStatus: {
      groundwaterDepth: 'SIMULATED',
      flowRate: 'SIMULATED',
      turbidity: 'SIMULATED',
    },
  };
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetSimulation(baselineDepth: number): SimulationState {
  const now = Date.now();
  return {
    ...createInitialSimState(),
    groundwaterDepthM: baselineDepth,
    sessionStartTime: now,
    lastTickTime: now,
  };
}
