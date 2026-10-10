import React, { useMemo } from 'react';
import { FileText, Download, Table, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SessionReport, AlertSeverity } from '../types/telemetry';

function buildReport(
  telemetryHistory: ReturnType<typeof useApp>['telemetryHistory'],
  chartHistory: ReturnType<typeof useApp>['chartHistory'],
  alerts: ReturnType<typeof useApp>['alerts'],
  simState: ReturnType<typeof useApp>['simState'],
  mode: string,
): SessionReport | null {
  if (telemetryHistory.length < 2) return null;

  const depths = telemetryHistory.map(r => r.groundwaterDepthM ?? 0).filter(Boolean);
  const flows = telemetryHistory.map(r => r.flowRateLpm);
  const turbs = telemetryHistory.map(r => r.turbidityNTU);

  const alertCounts: Record<AlertSeverity, number> = { INFO: 0, WARNING: 0, CRITICAL: 0 };
  alerts.forEach(a => { alertCounts[a.severity]++; });

  const notableEvents = alerts
    .filter(a => a.severity !== 'INFO')
    .slice(0, 8)
    .map(a => `[${new Date(a.timestamp).toLocaleTimeString('en-GB')}] ${a.severity}: ${a.title}`);

  return {
    generatedAt: Date.now(),
    mode: mode as 'SIMULATION' | 'HARDWARE',
    sessionStart: simState.sessionStartTime,
    sessionEnd: Date.now(),
    dataPoints: telemetryHistory.length,
    groundwater: {
      min: Math.min(...depths),
      max: Math.max(...depths),
      avg: depths.reduce((a, b) => a + b, 0) / depths.length,
      current: depths[depths.length - 1] ?? 0,
    },
    flow: {
      avg: flows.reduce((a, b) => a + b, 0) / flows.length,
      peak: Math.max(...flows),
      current: flows[flows.length - 1] ?? 0,
    },
    turbidity: {
      avg: turbs.reduce((a, b) => a + b, 0) / turbs.length,
      peak: Math.max(...turbs),
      current: turbs[turbs.length - 1] ?? 0,
    },
    totalExtractionL: telemetryHistory[telemetryHistory.length - 1]?.cumulativeExtractionL ?? 0,
    alertCounts,
    notableEvents,
  };
}

function exportCSV(telemetryHistory: ReturnType<typeof useApp>['telemetryHistory']) {
  const headers = ['Timestamp', 'Depth_m', 'FlowRate_Lpm', 'Turbidity_NTU', 'Pump', 'Extraction_L', 'Source'];
  const rows = telemetryHistory.map(r => [
    new Date(r.timestamp).toISOString(),
    r.groundwaterDepthM?.toFixed(4) ?? '',
    r.flowRateLpm.toFixed(4),
    r.turbidityNTU.toFixed(4),
    r.pumpOn ? 'ON' : 'OFF',
    r.cumulativeExtractionL.toFixed(4),
    r.source,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aquifer_telemetry_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHTMLReport(report: SessionReport) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Smart Aquifer Sentinel — Session Report</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background:#f8fafc; color:#1e293b; max-width:900px; margin:0 auto; padding:40px 24px; }
  h1 { color:#0f172a; margin-bottom:4px; }
  .subtitle { color:#64748b; font-size:14px; margin-bottom:32px; }
  .badge { display:inline-block; background:#e0f2fe; color:#0369a1; padding:2px 10px; border-radius:20px; font-size:12px; font-weight:600; margin-left:8px; }
  .section { margin:28px 0; }
  h2 { font-size:16px; color:#0369a1; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:8px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; }
  th { background:#f1f5f9; font-weight:600; color:#475569; }
  .val { font-family:monospace; font-weight:700; color:#0f172a; }
  .crit { color:#dc2626; font-weight:700; }
  .warn { color:#d97706; font-weight:700; }
  .ok   { color:#16a34a; font-weight:700; }
  .event { background:#fafafa; border:1px solid #e2e8f0; padding:6px 12px; border-radius:4px; margin:4px 0; font-size:13px; font-family:monospace; }
  .disclaimer { background:#fffbeb; border:1px solid #fde68a; padding:12px 16px; border-radius:6px; font-size:13px; color:#92400e; margin-top:32px; }
</style>
</head>
<body>
<h1>Smart Aquifer Sentinel <span class="badge">SIMULATION DATA</span></h1>
<div class="subtitle">Session Report — Generated ${new Date(report.generatedAt).toLocaleString('en-GB')}</div>

<div class="section">
<h2>Report Metadata</h2>
<table>
  <tr><th>Data Source</th><td class="val">${report.mode} (All readings are simulated demonstration data)</td></tr>
  <tr><th>Session Start</th><td class="val">${new Date(report.sessionStart).toLocaleString('en-GB')}</td></tr>
  <tr><th>Report Generated</th><td class="val">${new Date(report.generatedAt).toLocaleString('en-GB')}</td></tr>
  <tr><th>Data Points</th><td class="val">${report.dataPoints}</td></tr>
</table>
</div>

<div class="section">
<h2>Groundwater Depth (metres below reference)</h2>
<table>
  <tr><th>Current</th><td class="val">${report.groundwater.current.toFixed(2)} m</td></tr>
  <tr><th>Minimum (session)</th><td class="val ok">${report.groundwater.min.toFixed(2)} m</td></tr>
  <tr><th>Maximum (session)</th><td class="val crit">${report.groundwater.max.toFixed(2)} m</td></tr>
  <tr><th>Average (session)</th><td class="val">${report.groundwater.avg.toFixed(2)} m</td></tr>
</table>
</div>

<div class="section">
<h2>Flow Rate (L/min)</h2>
<table>
  <tr><th>Current</th><td class="val">${report.flow.current.toFixed(2)} L/min</td></tr>
  <tr><th>Average</th><td class="val">${report.flow.avg.toFixed(2)} L/min</td></tr>
  <tr><th>Peak</th><td class="val warn">${report.flow.peak.toFixed(2)} L/min</td></tr>
</table>
</div>

<div class="section">
<h2>Turbidity (NTU)</h2>
<table>
  <tr><th>Current</th><td class="val">${report.turbidity.current.toFixed(2)} NTU</td></tr>
  <tr><th>Average</th><td class="val">${report.turbidity.avg.toFixed(2)} NTU</td></tr>
  <tr><th>Peak</th><td class="val warn">${report.turbidity.peak.toFixed(2)} NTU</td></tr>
</table>
</div>

<div class="section">
<h2>Extraction & Alerts</h2>
<table>
  <tr><th>Total Simulated Extraction</th><td class="val">${report.totalExtractionL.toFixed(1)} L (${(report.totalExtractionL / 1000).toFixed(3)} kL)</td></tr>
  <tr><th>Critical Alerts</th><td class="val crit">${report.alertCounts.CRITICAL}</td></tr>
  <tr><th>Warnings</th><td class="val warn">${report.alertCounts.WARNING}</td></tr>
  <tr><th>Info Events</th><td>${report.alertCounts.INFO}</td></tr>
</table>
</div>

${report.notableEvents.length > 0 ? `
<div class="section">
<h2>Notable Events</h2>
${report.notableEvents.map(e => `<div class="event">${e}</div>`).join('')}
</div>` : ''}

<div class="disclaimer">
<strong>Disclaimer:</strong> All values in this report are simulated demonstration data generated by the Smart Aquifer Sentinel simulation engine. 
No physical sensors are connected. This report does not represent real groundwater measurements. Aquifer status and trend summaries are based on simplified rules and configurable thresholds, not calibrated hydrogeological models.
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aquifer_report_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { telemetryHistory, chartHistory, alerts, simState, settings } = useApp();

  const report = useMemo(
    () => buildReport(telemetryHistory, chartHistory, alerts, simState, settings.mode),
    [telemetryHistory, chartHistory, alerts, simState, settings.mode],
  );

  const hasData = telemetryHistory.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generated from recorded simulation telemetry — {telemetryHistory.length} data points</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => hasData && exportCSV(telemetryHistory)}
            disabled={!hasData}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              hasData
                ? 'bg-[#1e3a5f] hover:bg-[#2a4f7c] text-cyan-400 border-[#2a4f7c]'
                : 'bg-gray-800/30 text-gray-600 border-gray-700 cursor-not-allowed'
            }`}
          >
            <Table className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => report && exportHTMLReport(report)}
            disabled={!report}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              report
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent'
                : 'bg-gray-800/30 text-gray-600 border-gray-700 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            Export HTML Report
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="card p-16 text-center">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <div className="text-gray-500 text-sm mb-1">No telemetry recorded yet</div>
          <div className="text-gray-600 text-xs">Start the simulation and run for a few seconds to generate report data</div>
        </div>
      ) : report ? (
        <>
          {/* Report metadata */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <div className="section-title">Session Report</div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">
                  {report.mode} DATA
                </span>
                <span className="text-xs text-gray-600">
                  Generated {new Date(report.generatedAt).toLocaleTimeString('en-GB')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="card-sm p-3">
                <div className="label mb-1">Session Start</div>
                <div className="text-gray-300 font-mono">{new Date(report.sessionStart).toLocaleTimeString('en-GB')}</div>
              </div>
              <div className="card-sm p-3">
                <div className="label mb-1">Duration</div>
                <div className="text-gray-300 font-mono">
                  {Math.floor((report.sessionEnd - report.sessionStart) / 60000)}m {Math.floor(((report.sessionEnd - report.sessionStart) % 60000) / 1000)}s
                </div>
              </div>
              <div className="card-sm p-3">
                <div className="label mb-1">Data Points</div>
                <div className="text-gray-300 font-mono">{report.dataPoints}</div>
              </div>
              <div className="card-sm p-3">
                <div className="label mb-1">Mode</div>
                <div className="text-cyan-400 font-mono">{report.mode}</div>
              </div>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Groundwater */}
            <div className="card p-4">
              <div className="section-title mb-3">Groundwater Depth (m)</div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Current', value: report.groundwater.current.toFixed(2), color: 'text-cyan-300' },
                  { label: 'Minimum', value: report.groundwater.min.toFixed(2), color: 'text-green-300' },
                  { label: 'Maximum', value: report.groundwater.max.toFixed(2), color: 'text-red-300' },
                  { label: 'Average', value: report.groundwater.avg.toFixed(2), color: 'text-amber-300' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-500">{r.label}</span>
                    <span className={`font-mono font-bold ${r.color}`}>{r.value} m</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flow */}
            <div className="card p-4">
              <div className="section-title mb-3">Flow Rate (L/min)</div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Current', value: report.flow.current.toFixed(2), color: 'text-green-300' },
                  { label: 'Average', value: report.flow.avg.toFixed(2), color: 'text-cyan-300' },
                  { label: 'Peak', value: report.flow.peak.toFixed(2), color: 'text-amber-300' },
                  { label: 'Total Extracted', value: `${report.totalExtractionL.toFixed(0)} L`, color: 'text-blue-300' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-500">{r.label}</span>
                    <span className={`font-mono font-bold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Turbidity */}
            <div className="card p-4">
              <div className="section-title mb-3">Turbidity (NTU)</div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Current', value: report.turbidity.current.toFixed(2), color: 'text-amber-300' },
                  { label: 'Average', value: report.turbidity.avg.toFixed(2), color: 'text-cyan-300' },
                  { label: 'Peak', value: report.turbidity.peak.toFixed(2), color: 'text-red-300' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-500">{r.label}</span>
                    <span className={`font-mono font-bold ${r.color}`}>{r.value} NTU</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-[#1e3a5f] text-xs text-gray-600">
                  Demo threshold: {settings.turbidityThresholdNTU} NTU
                </div>
              </div>
            </div>
          </div>

          {/* Alert counts */}
          <div className="card p-4">
            <div className="section-title mb-3">Alert Summary</div>
            <div className="flex gap-6">
              {[
                { label: 'Critical', count: report.alertCounts.CRITICAL, color: 'text-red-400' },
                { label: 'Warning', count: report.alertCounts.WARNING, color: 'text-amber-400' },
                { label: 'Info', count: report.alertCounts.INFO, color: 'text-blue-400' },
                { label: 'Total', count: report.alertCounts.CRITICAL + report.alertCounts.WARNING + report.alertCounts.INFO, color: 'text-gray-300' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className={`text-3xl font-bold tabular-nums ${item.color}`}>{item.count}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notable events */}
          {report.notableEvents.length > 0 && (
            <div className="card p-4">
              <div className="section-title mb-3">Notable Events</div>
              <div className="space-y-1.5">
                {report.notableEvents.map((e, i) => (
                  <div key={i} className="text-xs font-mono bg-black/20 px-3 py-2 rounded border border-[#1e3a5f] text-gray-300">
                    {e}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend summary */}
          <div className="card p-4">
            <div className="section-title mb-3">Trend Summary</div>
            <div className="text-sm text-gray-300 space-y-2">
              <p>
                Over this session (<strong className="text-white">{report.dataPoints} data points</strong>), simulated groundwater depth ranged from{' '}
                <strong className="text-green-300">{report.groundwater.min.toFixed(1)} m</strong> to{' '}
                <strong className="text-red-300">{report.groundwater.max.toFixed(1)} m</strong> with an average of{' '}
                <strong className="text-cyan-300">{report.groundwater.avg.toFixed(1)} m</strong>.
              </p>
              <p>
                Peak flow reached <strong className="text-amber-300">{report.flow.peak.toFixed(1)} L/min</strong> with a session average of{' '}
                <strong className="text-white">{report.flow.avg.toFixed(1)} L/min</strong>. Total simulated extraction:{' '}
                <strong className="text-blue-300">{report.totalExtractionL.toFixed(0)} L ({(report.totalExtractionL / 1000).toFixed(3)} kL)</strong>.
              </p>
              <p className="text-gray-600 text-xs">
                All data is simulated. This report does not represent real groundwater conditions. Consult a licensed hydrogeologist for actual aquifer assessments.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
