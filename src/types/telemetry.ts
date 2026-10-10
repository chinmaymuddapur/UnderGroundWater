// ─── Telemetry Core Types ────────────────────────────────────────────────────

export type DataSource = 'SIMULATED' | 'HARDWARE';
export type SensorStatus = 'OK' | 'UNAVAILABLE' | 'ERROR' | 'SIMULATED';
export type SystemStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
export type PumpStatus = 'ON' | 'OFF';
export type SimMode = 'SIMULATION' | 'HARDWARE';

export interface TelemetryReading {
  timestamp: number;
  groundwaterDepthM: number | null;   // metres below reference (null = unavailable)
  flowRateLpm: number;                // litres per minute
  turbidityNTU: number;               // NTU
  pumpOn: boolean;
  cumulativeExtractionL: number;      // litres this session
  source: DataSource;
  sensorStatus: {
    groundwaterDepth: SensorStatus;
    flowRate: SensorStatus;
    turbidity: SensorStatus;
  };
}

export interface TelemetrySnapshot {
  current: TelemetryReading;
  systemStatus: SystemStatus;
  pumpStatus: PumpStatus;
  lastUpdated: number;
  sessionStartTime: number;
}

// ─── Alert / Event Types ─────────────────────────────────────────────────────

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  timestamp: number;
  resolvedAt?: number;
  title: string;
  message: string;
  triggeredBy: string;       // rule name
  explanation: string;
  recommendation: string;
  observedValue: string;
  metric: string;
}

// ─── Simulation Types ────────────────────────────────────────────────────────

export type SimScenario =
  | 'NORMAL'
  | 'HIGH_EXTRACTION'
  | 'POTENTIAL_LEAKAGE'
  | 'HIGH_TURBIDITY'
  | 'RECOVERY'
  | 'RANDOMIZED_TEST';

export interface SimulationConfig {
  updateIntervalMs: number;
  baselineDepthM: number;          // target recovery depth
  extractionSensitivity: number;   // how much depth changes per L/min per tick
  recoveryRateM: number;           // metres recovered per tick when pump off/low
  noiseAmplitude: number;
  maxDepthM: number;
  minDepthM: number;
}

export interface SimulationState {
  running: boolean;
  scenario: SimScenario;
  pumpOn: boolean;
  groundwaterDepthM: number;
  flowRateLpm: number;
  turbidityNTU: number;
  cumulativeExtractionL: number;
  sessionStartTime: number;
  lastTickTime: number;
  demoStage: number;               // for demo sequence
  demoRunning: boolean;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  mode: SimMode;
  depthWarningM: number;
  depthCriticalM: number;
  maxNormalFlowLpm: number;
  turbidityThresholdNTU: number;
  maxHistoryPoints: number;
  updateIntervalMs: number;
  hardwareEndpointUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  mode: 'SIMULATION',
  depthWarningM: 18,
  depthCriticalM: 25,
  maxNormalFlowLpm: 30,
  turbidityThresholdNTU: 10,
  maxHistoryPoints: 300,
  updateIntervalMs: 1500,
  hardwareEndpointUrl: '',
};

// ─── Chart / Report Types ─────────────────────────────────────────────────────

export interface ChartPoint {
  timestamp: number;
  time: string;
  groundwaterDepthM: number | null;
  flowRateLpm: number;
  turbidityNTU: number;
}

export interface SessionReport {
  generatedAt: number;
  mode: SimMode;
  sessionStart: number;
  sessionEnd: number;
  dataPoints: number;
  groundwater: {
    min: number;
    max: number;
    avg: number;
    current: number;
  };
  flow: {
    avg: number;
    peak: number;
    current: number;
  };
  turbidity: {
    avg: number;
    peak: number;
    current: number;
  };
  totalExtractionL: number;
  alertCounts: Record<AlertSeverity, number>;
  notableEvents: string[];
}

// ─── Hardware Provider Interface ──────────────────────────────────────────────

export interface TelemetryProvider {
  readonly name: string;
  readonly source: DataSource;
  isConnected(): boolean;
  getLatestReading(): TelemetryReading | null;
  start(): void;
  stop(): void;
}
