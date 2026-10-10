/**
 * Smart Aquifer Sentinel — Production Backend  v1.1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives ESP32 sensor readings and serves them to the React dashboard.
 *
 * Security:
 *   • CORS locked to ALLOWED_ORIGINS environment variable
 *   • POST /api/telemetry requires X-Device-Token header (device auth)
 *   • All input validated and range-checked before storage
 *   • Body limited to 16 KB
 *   • No secrets in GET responses
 *
 * Storage:
 *   • SQLite via better-sqlite3 when available (production on Render)
 *   • In-memory ring-buffer fallback (local dev / Node 24 on Windows)
 *
 * Environment variables — see server/.env.example for full documentation.
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const storage = require('./storage');

// ─── Load .env file if present (local dev only) ───────────────────────────────
// Production platforms (Render, Railway) inject env vars directly.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx < 0) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT               = parseInt(process.env.PORT                   || '3001',  10);
const STALE_THRESHOLD_MS = parseInt(process.env.STALE_THRESHOLD_SECONDS || '15',   10) * 1000;
const MAX_HISTORY_ROWS   = parseInt(process.env.MAX_HISTORY_ROWS        || '300',  10);
const DB_PATH            = process.env.DB_PATH || path.join(__dirname, 'telemetry.db');
const DEVICE_AUTH_TOKEN  = process.env.DEVICE_AUTH_TOKEN || '';

// Comma-separated allowed origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

// Warn loudly if auth token is missing or still the example value
const TOKEN_CONFIGURED =
  DEVICE_AUTH_TOKEN.length > 0 &&
  DEVICE_AUTH_TOKEN !== 'change-me-to-a-long-random-secret';

if (!TOKEN_CONFIGURED) {
  console.warn('[WARN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('[WARN] DEVICE_AUTH_TOKEN is not configured.');
  console.warn('[WARN] POST /api/telemetry will return 503 until token is set.');
  console.warn('[WARN] Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.warn('[WARN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ─── Storage init ─────────────────────────────────────────────────────────────

let latestReading = storage.init(DB_PATH, MAX_HISTORY_ROWS);

// ─── Express setup ────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin(origin, cb) {
    // Allow requests with no Origin (curl, server-to-server, health checks)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  methods:        ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Device-Token'],
}));

app.use(express.json({ limit: '16kb' }));

// ─── Middleware: device authentication ───────────────────────────────────────

function requireDeviceToken(req, res, next) {
  if (!TOKEN_CONFIGURED) {
    return res.status(503).json({
      ok:    false,
      error: 'Backend not configured: DEVICE_AUTH_TOKEN must be set in environment variables.',
    });
  }
  const token = req.headers['x-device-token'];
  if (!token || token !== DEVICE_AUTH_TOKEN) {
    console.warn(`[AUTH] Rejected — bad token from ${req.ip}`);
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body must be a JSON object' };
  }
  if (body.source !== 'hardware') {
    return { valid: false, error: 'source must be exactly "hardware"' };
  }
  if (typeof body.flowRateLpm !== 'number' || !isFinite(body.flowRateLpm)) {
    return { valid: false, error: 'flowRateLpm must be a finite number' };
  }
  if (body.flowRateLpm < 0 || body.flowRateLpm > 500) {
    return { valid: false, error: 'flowRateLpm out of range 0–500' };
  }
  if (typeof body.turbidityRaw !== 'number' || !isFinite(body.turbidityRaw)) {
    return { valid: false, error: 'turbidityRaw must be a finite number' };
  }
  if (body.turbidityRaw < 0 || body.turbidityRaw > 4095) {
    return { valid: false, error: 'turbidityRaw out of range 0–4095' };
  }
  if (typeof body.pumpOn !== 'boolean') {
    return { valid: false, error: 'pumpOn must be a boolean' };
  }

  // Timestamp: use provided value if within 60 s of server clock, else server time
  const serverNow = Date.now();
  let ts = serverNow;
  if (body.timestamp !== undefined) {
    if (typeof body.timestamp !== 'number' || !isFinite(body.timestamp)) {
      return { valid: false, error: 'timestamp must be a number (Unix ms)' };
    }
    if (Math.abs(body.timestamp - serverNow) <= 60_000) ts = body.timestamp;
    else console.warn('[WARN] Timestamp drift > 60 s — using server time');
  }

  // Optional calibrated turbidity NTU (only accepted when explicitly provided)
  const turbidityNTU =
    typeof body.turbidityNTU === 'number' &&
    isFinite(body.turbidityNTU) &&
    body.turbidityNTU >= 0 &&
    body.turbidityNTU <= 3000
      ? Number(body.turbidityNTU.toFixed(4))
      : null;

  return {
    valid: true,
    reading: {
      timestamp:         ts,
      serverReceivedAt:  serverNow,
      source:            'HARDWARE',
      flowRateLpm:       Number(body.flowRateLpm.toFixed(4)),
      turbidityRaw:      Math.round(body.turbidityRaw),
      turbidityNTU,
      pumpOn:            body.pumpOn,
      groundwaterDepthM: null,          // no depth sensor
      sensorStatus: {
        groundwaterDepth: 'UNAVAILABLE',
        flowRate:  'OK',
        turbidity: 'OK',
      },
    },
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/telemetry — called by ESP32
app.post('/api/telemetry', requireDeviceToken, (req, res) => {
  const result = validatePayload(req.body);
  if (!result.valid) {
    console.warn(`[REJECT] ${result.error} | body: ${JSON.stringify(req.body)}`);
    return res.status(400).json({ ok: false, error: result.error });
  }

  latestReading = storage.insert(result.reading, MAX_HISTORY_ROWS);

  console.log(
    `[OK] flow=${latestReading.flowRateLpm} L/min` +
    ` turbRaw=${latestReading.turbidityRaw}` +
    (latestReading.turbidityNTU !== null ? ` turbNTU=${latestReading.turbidityNTU}` : '') +
    ` pump=${latestReading.pumpOn}`
  );

  return res.status(200).json({ ok: true, ts: latestReading.timestamp });
});

// GET /api/telemetry/latest — polled by React dashboard
app.get('/api/telemetry/latest', (req, res) => {
  const now       = Date.now();
  const connected = latestReading !== null &&
    (now - latestReading.serverReceivedAt) < STALE_THRESHOLD_MS;

  return res.json({
    connected,
    staleThresholdMs: STALE_THRESHOLD_MS,
    reading:          connected ? latestReading : null,
    lastSeenAt:       latestReading?.serverReceivedAt ?? null,
    staleSinceMs:     latestReading ? (now - latestReading.serverReceivedAt) : null,
  });
});

// GET /api/telemetry/history
app.get('/api/telemetry/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || MAX_HISTORY_ROWS, MAX_HISTORY_ROWS);
  const readings = storage.getHistory(limit);
  return res.json({ count: readings.length, readings });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  const now       = Date.now();
  const connected = latestReading !== null &&
    (now - latestReading.serverReceivedAt) < STALE_THRESHOLD_MS;

  return res.json({
    ok:              true,
    server:          'Smart Aquifer Sentinel Backend',
    version:         '1.1.0',
    uptime:          Math.floor(process.uptime()),
    deviceConnected: connected,
    totalReadings:   storage.count(),
    lastReadingAt:   latestReading
                       ? new Date(latestReading.serverReceivedAt).toISOString()
                       : null,
    storage:         storage.storageType(),
  });
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `No such endpoint: ${req.method} ${req.path}` });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Smart Aquifer Sentinel — Backend  v1.1.0    ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`  Port          : ${PORT}`);
  console.log(`  CORS origins  : ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`  Device auth   : ${TOKEN_CONFIGURED ? 'ENABLED (X-Device-Token)' : 'NOT CONFIGURED'}`);
  console.log(`  Storage       : ${storage.storageType()}`);
  console.log(`  Stale timeout : ${STALE_THRESHOLD_MS / 1000}s`);
  console.log('');
});
