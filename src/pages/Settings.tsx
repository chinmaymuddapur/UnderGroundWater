import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RotateCcw,
  Save,
  Info,
  Cpu,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Server,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_SETTINGS } from '../types/telemetry';

export default function Settings() {
  const { settings, updateSettings, resetSim, hardwareState, currentReading } = useApp();
  const [saved, setSaved] = useState(false);
  const [backendTestResult, setBackendTestResult] = useState<string | null>(null);
  const [backendTesting, setBackendTesting] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleResetDefaults() {
    updateSettings(DEFAULT_SETTINGS);
    resetSim();
  }

  function clearLocalStorage() {
    try { localStorage.removeItem('sas_settings'); } catch { /* ignore */ }
    updateSettings(DEFAULT_SETTINGS);
    resetSim();
  }

  async function testBackend() {
    setBackendTesting(true);
    setBackendTestResult(null);
    // Resolve API base the same way HardwareProvider does
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
    const healthUrl = `${apiBase.replace(/\/$/, '')}/api/health`;
    try {
      const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const data = await resp.json();
        setBackendTestResult(
          `✓ Backend reachable (${data.storage}). Uptime: ${data.uptime}s. ` +
          `Auth: ${data.deviceConnected !== undefined ? 'configured' : '?'}. ` +
          `Device: ${data.deviceConnected ? 'CONNECTED' : 'NOT CONNECTED'}. ` +
          `Readings: ${data.totalReadings}.`
        );
      } else {
        setBackendTestResult(`✗ Backend responded HTTP ${resp.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackendTestResult(`✗ Cannot reach backend: ${msg}`);
    } finally {
      setBackendTesting(false);
    }
  }

  // Formatted last-seen time
  const lastSeenFormatted = hardwareState?.lastSeenAt
    ? new Date(hardwareState.lastSeenAt).toLocaleTimeString('en-GB')
    : null;

  const staleSec = hardwareState?.staleSinceMs
    ? (hardwareState.staleSinceMs / 1000).toFixed(1)
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Settings are persisted locally in your browser</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleResetDefaults} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── Mode selector ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <div className="section-title">Operating Mode</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Simulation */}
          <button
            onClick={() => updateSettings({ mode: 'SIMULATION' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              settings.mode === 'SIMULATION'
                ? 'border-cyan-500/60 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                : 'border-gray-700 bg-[#111d35] hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cpu className={`w-5 h-5 ${settings.mode === 'SIMULATION' ? 'text-cyan-400' : 'text-gray-500'}`} />
              <span className={`font-semibold text-sm ${settings.mode === 'SIMULATION' ? 'text-cyan-300' : 'text-gray-400'}`}>
                Simulation Mode
              </span>
              {settings.mode === 'SIMULATION' && (
                <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              All telemetry is generated internally. All values are labelled SIMULATED / DEMO DATA.
              No hardware required. Ideal for competition demonstration.
            </p>
          </button>

          {/* Hardware */}
          <button
            onClick={() => updateSettings({ mode: 'HARDWARE' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              settings.mode === 'HARDWARE'
                ? 'border-green-500/60 bg-green-500/5 ring-1 ring-green-500/20'
                : 'border-gray-700 bg-[#111d35] hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Wifi className={`w-5 h-5 ${settings.mode === 'HARDWARE' ? 'text-green-400' : 'text-gray-500'}`} />
              <span className={`font-semibold text-sm ${settings.mode === 'HARDWARE' ? 'text-green-300' : 'text-gray-400'}`}>
                Hardware Mode
              </span>
              {settings.mode === 'HARDWARE' && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  hardwareState?.connected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {hardwareState?.connected
                    ? <><CheckCircle className="w-2.5 h-2.5" /> CONNECTED</>
                    : <><WifiOff className="w-2.5 h-2.5" /> NOT CONNECTED</>
                  }
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Receives real sensor readings from ESP32 via the laptop backend.
              Simulation engine is suspended. Groundwater depth remains UNAVAILABLE.
            </p>
          </button>
        </div>

        {/* Hardware mode detail banner */}
        {settings.mode === 'HARDWARE' && (
          <div className={`mt-4 p-3 rounded-lg border text-xs flex gap-2 ${
            hardwareState?.connected
              ? 'bg-green-500/5 border-green-500/20 text-green-300'
              : 'bg-orange-500/5 border-orange-500/20 text-orange-300'
          }`}>
            {hardwareState?.connected
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            }
            <div>
              {hardwareState?.connected ? (
                <>
                  <strong>ESP32 connected.</strong> Receiving real sensor data.
                  {lastSeenFormatted && <> Last reading at {lastSeenFormatted}.</>}
                  {currentReading && (
                    <span className="ml-1 text-green-400 font-mono">
                      Flow: {currentReading.flowRateLpm.toFixed(1)} L/min,
                      Turb: {currentReading.turbidityNTU.toFixed(1)} NTU
                    </span>
                  )}
                </>
              ) : (
                <>
                  <strong>Hardware not connected.</strong>{' '}
                  {hardwareState?.error && <span className="text-orange-400">{hardwareState.error}. </span>}
                  {staleSec && parseFloat(staleSec) > 0
                    ? `No reading for ${staleSec}s. `
                    : 'Waiting for first reading. '
                  }
                  Make sure the backend is running and the ESP32 is posting to port 3001.
                  Simulation data is NOT substituted.
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Backend connection ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-cyan-400" />
          <div className="section-title">Backend Server (Port 3001)</div>
        </div>

        <div className="space-y-3">
          {/* Live status indicators */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Backend',
                value: settings.mode === 'HARDWARE'
                  ? (hardwareState === null ? 'Checking…' : hardwareState.error?.includes('reach') ? 'OFFLINE' : 'ONLINE')
                  : 'Not polling',
                color: settings.mode === 'HARDWARE' && hardwareState && !hardwareState.error?.includes('reach')
                  ? 'text-green-400' : 'text-gray-500',
              },
              {
                label: 'ESP32',
                value: hardwareState?.connected ? 'CONNECTED' : 'DISCONNECTED',
                color: hardwareState?.connected ? 'text-green-400' : 'text-orange-400',
              },
              {
                label: 'Last reading',
                value: lastSeenFormatted ?? '—',
                color: 'text-gray-300',
              },
            ].map(item => (
              <div key={item.label} className="card-sm p-3">
                <div className="label mb-1">{item.label}</div>
                <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Backend health test */}
          <div className="flex items-center gap-3">
            <button
              onClick={testBackend}
              disabled={backendTesting}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <Server className="w-3.5 h-3.5" />
              {backendTesting ? 'Testing…' : 'Test Backend Health'}
            </button>
            {backendTestResult && (
              <span className={`text-xs ${backendTestResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {backendTestResult}
              </span>
            )}
          </div>

          {/* Setup instructions */}
          <div className="p-3 bg-[#111d35] border border-[#1e3a5f] rounded-lg">
            <div className="text-xs font-semibold text-gray-300 mb-2">Backend Setup</div>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
              <li>
                Open a separate terminal and run:{' '}
                <code className="px-1.5 py-0.5 bg-black/40 rounded text-cyan-300">npm run server</code>
              </li>
              <li>
                Find your laptop's LAN IP:{' '}
                <code className="px-1.5 py-0.5 bg-black/40 rounded text-cyan-300">ipconfig</code>
                {' '}→ look for IPv4 Address under your Wi-Fi adapter
              </li>
              <li>Set that IP in the ESP32 sketch as <code className="px-1 bg-black/40 rounded text-cyan-300">LAPTOP_IP</code></li>
              <li>ESP32 posts to <code className="px-1 bg-black/40 rounded text-cyan-300">http://&lt;LAPTOP_IP&gt;:3001/api/telemetry</code></li>
              <li>Switch to Hardware Mode above — readings appear automatically</li>
            </ol>
          </div>

          {/* Test curl command */}
          <div className="p-3 bg-black/20 border border-[#1e3a5f] rounded-lg">
            <div className="text-xs font-semibold text-gray-400 mb-2">Test with PowerShell (no ESP32 needed)</div>
            <code className="text-[11px] text-green-300 font-mono break-all leading-relaxed">
              {`Invoke-RestMethod -Uri http://localhost:3001/api/telemetry -Method POST -ContentType 'application/json' -Body '{"source":"hardware","flowRateLpm":18.5,"turbidityRaw":2100,"pumpOn":true}'`}
            </code>
          </div>
        </div>
      </div>

      {/* ── Alert thresholds ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <div className="section-title">Alert Thresholds</div>
          <span className="text-[10px] text-gray-600 ml-1">— apply in both Simulation and Hardware modes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: 'Depth Warning Threshold', sublabel: 'Metres below ground reference (simulation only)', key: 'depthWarningM' as const, value: settings.depthWarningM, min: 5, max: 35, color: 'text-amber-400', accentColor: 'accent-amber-500', unit: 'm' },
            { label: 'Depth Critical Threshold', sublabel: 'Metres below ground reference (simulation only)', key: 'depthCriticalM' as const, value: settings.depthCriticalM, min: 10, max: 40, color: 'text-red-400', accentColor: 'accent-red-500', unit: 'm' },
            { label: 'Maximum Normal Flow', sublabel: 'Above this value triggers a warning', key: 'maxNormalFlowLpm' as const, value: settings.maxNormalFlowLpm, min: 5, max: 80, color: 'text-green-400', accentColor: 'accent-green-500', unit: 'L/min' },
            { label: 'Turbidity Alert Threshold', sublabel: 'Configurable demo threshold — not a safety limit', key: 'turbidityThresholdNTU' as const, value: settings.turbidityThresholdNTU, min: 1, max: 50, color: 'text-yellow-400', accentColor: 'accent-yellow-500', unit: 'NTU' },
          ].map(item => (
            <div key={item.key} className="card-sm p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-300">{item.label}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{item.sublabel}</div>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-lg">
                  <span className={`text-lg font-bold tabular-nums font-mono ${item.color}`}>{item.value}</span>
                  <span className="text-xs text-gray-500">{item.unit}</span>
                </div>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={0.5}
                value={item.value}
                onChange={e => updateSettings({ [item.key]: +e.target.value })}
                className={`w-full ${item.accentColor}`}
              />
              <div className="flex justify-between text-[10px] text-gray-700 mt-1">
                <span>{item.min} {item.unit}</span>
                <span>{item.max} {item.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Simulation settings ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <div className="section-title">Simulation Settings</div>
          <span className="text-[10px] text-gray-600 ml-1">— inactive while in Hardware Mode</span>
        </div>
        <div className="space-y-4">
          <div className="card-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm font-medium text-gray-300">Update Interval</div>
                <div className="text-xs text-gray-600 mt-0.5">How often simulation updates (ms).</div>
              </div>
              <span className="text-lg font-bold tabular-nums font-mono text-cyan-400">{settings.updateIntervalMs} ms</span>
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
            <div className="text-[10px] text-gray-700 mt-1">⚠ Takes effect after Reset + Start</div>
          </div>
          <div className="card-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm font-medium text-gray-300">Max History Points</div>
                <div className="text-xs text-gray-600 mt-0.5">Maximum readings retained in memory.</div>
              </div>
              <span className="text-lg font-bold tabular-nums font-mono text-cyan-400">{settings.maxHistoryPoints}</span>
            </div>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={settings.maxHistoryPoints}
              onChange={e => updateSettings({ maxHistoryPoints: +e.target.value })}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* ── Data management ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-4 h-4 text-gray-500" />
          <div className="section-title">Data Management</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 card-sm">
            <div>
              <div className="text-sm font-medium text-gray-300">Reset Session & Clear Data</div>
              <div className="text-xs text-gray-600 mt-0.5">Clears telemetry history, alerts, and chart data</div>
            </div>
            <button onClick={resetSim} className="btn-warning flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reset Data
            </button>
          </div>
          <div className="flex items-center justify-between p-3 card-sm">
            <div>
              <div className="text-sm font-medium text-gray-300">Reset Settings to Defaults</div>
              <div className="text-xs text-gray-600 mt-0.5">Clears localStorage and restores factory defaults</div>
            </div>
            <button onClick={clearLocalStorage} className="btn-danger flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reset All
            </button>
          </div>
        </div>
      </div>

      {/* ── Hardware architecture ── */}
      <div className="card p-5 border-blue-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-400" />
          <div className="section-title text-blue-300">Hardware Integration Architecture</div>
        </div>
        <div className="text-sm text-gray-400 space-y-2 leading-relaxed">
          <p>ESP32 → Wi-Fi → <code className="px-1 bg-black/30 rounded text-cyan-300 text-xs">POST /api/telemetry</code> →
            Node.js backend (port 3001) → <code className="px-1 bg-black/30 rounded text-cyan-300 text-xs">GET /api/telemetry/latest</code> →
            React frontend (port 5173, every 2 s).</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500 mt-2">
            <li>Flow sensor: pulse-count interrupt on GPIO → L/min calculation in firmware</li>
            <li>Turbidity: 12-bit ADC read → raw value sent as <code className="text-cyan-300">turbidityRaw</code></li>
            <li>Groundwater depth: <strong className="text-orange-400">UNAVAILABLE</strong> — no depth sensor connected</li>
            <li>Frontend converts raw ADC to approximate NTU for display (labelled approximate)</li>
            <li>
              To add a calibrated NTU value: add <code className="text-cyan-300">turbidityNTU</code> to the ESP32 POST payload after calibration
            </li>
          </ol>
          <p className="text-xs text-gray-600 mt-2">
            See <code className="text-cyan-300">esp32/AquiferSentinel/AquiferSentinel.ino</code> and{' '}
            <code className="text-cyan-300">esp32/WIRING_AND_SETUP.md</code> for full hardware setup guide.
          </p>
        </div>
      </div>
    </div>
  );
}
