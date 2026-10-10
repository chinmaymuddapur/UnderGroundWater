import { TelemetryReading, Alert, AlertSeverity, AppSettings } from '../types/telemetry';

// ─── Rule Definitions ─────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  check: (reading: TelemetryReading, settings: AppSettings, history: TelemetryReading[]) => RuleResult | null;
}

export interface RuleResult {
  severity: AlertSeverity;
  title: string;
  message: string;
  explanation: string;
  recommendation: string;
  observedValue: string;
  metric: string;
}

// Track last-alert times per rule to prevent flickering
const lastAlertTime: Record<string, number> = {};
const DEBOUNCE_MS = 15000; // 15 seconds between same-rule alerts

function canTrigger(ruleId: string): boolean {
  const now = Date.now();
  const last = lastAlertTime[ruleId] ?? 0;
  if (now - last > DEBOUNCE_MS) {
    lastAlertTime[ruleId] = now;
    return true;
  }
  return false;
}

export function resetRuleDebounce(): void {
  Object.keys(lastAlertTime).forEach(k => delete lastAlertTime[k]);
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export const RULES: Rule[] = [
  {
    id: 'DEPTH_WARNING',
    name: 'Groundwater Depth Warning',
    check(reading, settings) {
      if (
        reading.groundwaterDepthM !== null &&
        reading.groundwaterDepthM >= settings.depthWarningM &&
        reading.groundwaterDepthM < settings.depthCriticalM
      ) {
        return {
          severity: 'WARNING',
          title: 'Groundwater Depth Warning',
          metric: 'Groundwater Depth',
          observedValue: `${reading.groundwaterDepthM.toFixed(1)} m`,
          message: `Simulated groundwater depth (${reading.groundwaterDepthM.toFixed(1)} m) exceeded the warning threshold of ${settings.depthWarningM} m.`,
          explanation: `The simulated water table has dropped below the configured warning depth. This may indicate sustained high extraction or reduced recharge in the model.`,
          recommendation: 'Consider reducing extraction rate or switching to the Recovery scenario to allow the simulated water table to recover.',
        };
      }
      return null;
    },
  },
  {
    id: 'DEPTH_CRITICAL',
    name: 'Groundwater Depth Critical',
    check(reading, settings) {
      if (
        reading.groundwaterDepthM !== null &&
        reading.groundwaterDepthM >= settings.depthCriticalM
      ) {
        return {
          severity: 'CRITICAL',
          title: 'Critical Groundwater Depth',
          metric: 'Groundwater Depth',
          observedValue: `${reading.groundwaterDepthM.toFixed(1)} m`,
          message: `Simulated groundwater depth (${reading.groundwaterDepthM.toFixed(1)} m) exceeded the critical threshold of ${settings.depthCriticalM} m.`,
          explanation: `The simulated water table has reached a critically low level. Continued extraction at this depth could model aquifer over-exploitation in a real scenario.`,
          recommendation: 'Immediately activate Recovery scenario or turn pump OFF. Investigate extraction rate.',
        };
      }
      return null;
    },
  },
  {
    id: 'HIGH_FLOW',
    name: 'Abnormal Flow Rate',
    check(reading, settings) {
      if (reading.flowRateLpm > settings.maxNormalFlowLpm) {
        return {
          severity: 'WARNING',
          title: 'High Extraction Flow Detected',
          metric: 'Flow Rate',
          observedValue: `${reading.flowRateLpm.toFixed(1)} L/min`,
          message: `Flow rate (${reading.flowRateLpm.toFixed(1)} L/min) exceeds configured normal maximum of ${settings.maxNormalFlowLpm} L/min.`,
          explanation: `Flow rate is above the normal operating range. This could indicate aggressive extraction, a stuck valve, or an anomaly in the system.`,
          recommendation: 'Verify pump settings and check for unintended extraction events.',
        };
      }
      return null;
    },
  },
  {
    id: 'HIGH_TURBIDITY',
    name: 'Turbidity Threshold Exceeded',
    check(reading, settings) {
      if (reading.turbidityNTU > settings.turbidityThresholdNTU) {
        return {
          severity: 'WARNING',
          title: 'Turbidity Threshold Exceeded',
          metric: 'Turbidity',
          observedValue: `${reading.turbidityNTU.toFixed(1)} NTU`,
          message: `Turbidity (${reading.turbidityNTU.toFixed(1)} NTU) exceeded the configured demonstration threshold of ${settings.turbidityThresholdNTU} NTU.`,
          explanation: `Elevated turbidity may indicate sediment disturbance, aquifer distress, or a quality event. Note: turbidity alone does not determine water safety — this threshold is a configurable demonstration value only.`,
          recommendation: 'Investigate turbidity source. Consider reducing flow rate to allow sediment settling.',
        };
      }
      return null;
    },
  },
  {
    id: 'PUMP_OFF_FLOW',
    name: 'Flow While Pump Off',
    check(reading) {
      if (!reading.pumpOn && reading.flowRateLpm > 3.0) {
        return {
          severity: 'CRITICAL',
          title: 'Unexpected Flow — Pump Marked OFF',
          metric: 'Flow Rate',
          observedValue: `${reading.flowRateLpm.toFixed(1)} L/min`,
          message: `Flow rate of ${reading.flowRateLpm.toFixed(1)} L/min detected while pump is marked OFF.`,
          explanation: `Flow should approach zero when the pump is OFF. Continued flow may indicate a valve failure, leakage, or sensor anomaly in a real installation.`,
          recommendation: 'Inspect valve and pump actuator. Check for uncontrolled flow paths.',
        };
      }
      return null;
    },
  },
  {
    id: 'LEAKAGE_PATTERN',
    name: 'Potential Leakage Pattern',
    check(reading, settings, history) {
      if (history.length < 10) return null;
      const recent = history.slice(-10);
      const avgFlow = recent.reduce((s, r) => s + r.flowRateLpm, 0) / recent.length;
      const variance = recent.reduce((s, r) => s + Math.abs(r.flowRateLpm - avgFlow), 0) / recent.length;

      // High sustained flow + high variance = leakage pattern
      if (avgFlow > settings.maxNormalFlowLpm * 0.85 && variance > 5) {
        return {
          severity: 'WARNING',
          title: 'Potential Anomaly — Investigate Possible Leakage',
          metric: 'Flow Pattern',
          observedValue: `Avg ${avgFlow.toFixed(1)} L/min, Variance ${variance.toFixed(1)}`,
          message: `Sustained high flow with irregular variance over the last 10 readings. This pattern may be consistent with a leakage anomaly.`,
          explanation: `High average flow combined with irregular fluctuations is a potential indicator of an uncontrolled flow path. This is a rule-based inference — physical inspection is required to confirm.`,
          recommendation: 'Investigate pipe connections and valve integrity. Consider activating the Recovery scenario.',
        };
      }
      return null;
    },
  },
];

// ─── Evaluate Rules ───────────────────────────────────────────────────────────

export function evaluateRules(
  reading: TelemetryReading,
  settings: AppSettings,
  history: TelemetryReading[],
): Alert[] {
  const alerts: Alert[] = [];

  for (const rule of RULES) {
    if (!canTrigger(rule.id)) continue;
    const result = rule.check(reading, settings, history);
    if (result) {
      alerts.push({
        id: `${rule.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        severity: result.severity,
        status: 'ACTIVE',
        timestamp: Date.now(),
        title: result.title,
        message: result.message,
        triggeredBy: rule.name,
        explanation: result.explanation,
        recommendation: result.recommendation,
        observedValue: result.observedValue,
        metric: result.metric,
      });
    }
  }

  return alerts;
}
