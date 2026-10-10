/**
 * HardwareProvider
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls the backend server for ESP32 sensor readings.
 *
 * URL resolution:
 *   - Development : VITE_API_BASE_URL is empty → fetch('/api/...') goes through
 *                   the Vite dev-server proxy to localhost:3001.
 *   - Production  : VITE_API_BASE_URL = 'https://aquifer-sentinel-api.onrender.com'
 *                   → full absolute URL used; no proxy involved.
 *
 * Security contract:
 *   - Returns source='HARDWARE' only when a fresh, validated reading is received.
 *   - Never falls back to simulation values.
 *   - groundwaterDepthM is always null (no depth sensor).
 *   - turbidityNTU uses calibrated value if provided; otherwise approximate ADC
 *     conversion clearly labelled as approximate.
 */

import type { TelemetryReading } from '../types/telemetry';

// ─── API base URL ─────────────────────────────────────────────────────────────
// import.meta.env.VITE_API_BASE_URL is injected at build time by Vite.
// Empty string → relative paths → Vite proxy handles it in dev,
// Netlify rewrites handle it in production (see netlify.toml).
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

function apiUrl(path: string): string {
  // Strip trailing slash from base, ensure path starts with /
  const base = API_BASE.replace(/\/$/, '');
  const p    = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HardwareConnectionState {
  connected: boolean;
  lastSeenAt: number | null;
  staleSinceMs: number | null;
  error: string | null;
}

export interface BackendLatestResponse {
  connected: boolean;
  staleThresholdMs: number;
  reading: BackendReading | null;
  lastSeenAt: number | null;
  staleSinceMs: number | null;
}

export interface BackendReading {
  timestamp: number;
  serverReceivedAt: number;
  source: 'HARDWARE';
  flowRateLpm: number;
  turbidityRaw: number;
  turbidityNTU: number | null;
  pumpOn: boolean;
  groundwaterDepthM: null;
  sensorStatus: {
    groundwaterDepth: 'UNAVAILABLE';
    flowRate: 'OK' | 'ERROR';
    turbidity: 'OK' | 'ERROR';
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type OnReadingCallback = (reading: TelemetryReading) => void;
type OnStatusCallback  = (state: HardwareConnectionState) => void;

export class HardwareProvider {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly onReading: OnReadingCallback;
  private readonly onStatus:  OnStatusCallback;
  private readonly pollIntervalMs: number;

  private cumulativeExtractionL = 0;
  private lastTimestamp: number | null = null;

  constructor(opts: {
    onReading: OnReadingCallback;
    onStatus:  OnStatusCallback;
    pollIntervalMs?: number;
  }) {
    this.onReading      = opts.onReading;
    this.onStatus       = opts.onStatus;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
  }

  start(): void {
    if (this.intervalId) return;
    this.cumulativeExtractionL = 0;
    this.lastTimestamp = null;
    void this.poll();
    this.intervalId = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetSession(): void {
    this.cumulativeExtractionL = 0;
    this.lastTimestamp = null;
  }

  private async poll(): Promise<void> {
    try {
      const resp = await fetch(apiUrl('/api/telemetry/latest'), {
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        this.onStatus({
          connected: false,
          lastSeenAt: null,
          staleSinceMs: null,
          error: `Backend returned HTTP ${resp.status}`,
        });
        return;
      }

      const data: BackendLatestResponse = await resp.json();

      if (!data.connected || !data.reading) {
        this.onStatus({
          connected: false,
          lastSeenAt: data.lastSeenAt,
          staleSinceMs: data.staleSinceMs,
          error: null,
        });
        return;
      }

      const r = data.reading;

      // Cumulative extraction — pump-on elapsed time only
      if (this.lastTimestamp !== null && r.pumpOn) {
        const dtSeconds = Math.min((r.serverReceivedAt - this.lastTimestamp) / 1000, 10);
        this.cumulativeExtractionL += (r.flowRateLpm * dtSeconds) / 60;
      }
      this.lastTimestamp = r.serverReceivedAt;

      const turbidityNTU = r.turbidityNTU !== null
        ? r.turbidityNTU
        : rawAdcToApproximateNTU(r.turbidityRaw);

      const reading: TelemetryReading = {
        timestamp:             r.timestamp,
        groundwaterDepthM:     null,          // UNAVAILABLE — no depth sensor
        flowRateLpm:           r.flowRateLpm,
        turbidityNTU,
        pumpOn:                r.pumpOn,
        cumulativeExtractionL: this.cumulativeExtractionL,
        source:                'HARDWARE',
        sensorStatus: {
          groundwaterDepth: 'UNAVAILABLE',
          flowRate:  'OK',
          turbidity: 'OK',
        },
      };

      this.onStatus({
        connected:   true,
        lastSeenAt:  r.serverReceivedAt,
        staleSinceMs: 0,
        error:       null,
      });

      this.onReading(reading);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown fetch error';
      this.onStatus({
        connected:   false,
        lastSeenAt:  null,
        staleSinceMs: null,
        error:       `Cannot reach backend: ${msg}`,
      });
    }
  }
}

// ─── Approximate ADC → NTU conversion ────────────────────────────────────────
/**
 * APPROXIMATE display-only conversion. Not calibrated. Not a safety reference.
 * Higher ADC ≈ clearer water ≈ lower NTU (typical for common hobby sensors).
 * Replace with site-calibrated polynomial once reference measurements are available.
 */
function rawAdcToApproximateNTU(adcValue: number): number {
  return parseFloat(Math.max(0, ((4095 - adcValue) / 4095) * 3000).toFixed(2));
}
