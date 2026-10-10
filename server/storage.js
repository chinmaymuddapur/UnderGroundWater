/**
 * storage.js — Pluggable telemetry storage
 *
 * Tries to load better-sqlite3 (available on Render/Linux with prebuilt binaries).
 * If unavailable (e.g. Node 24 on Windows without build tools), falls back to
 * an in-memory ring-buffer. The fallback is fine for local dev; on Render
 * with a persistent disk the SQLite path is used and survives restarts.
 */

'use strict';

const path = require('path');

// ─── Try to load SQLite ───────────────────────────────────────────────────────

let db = null;
let usingDb = false;

function tryOpenSqlite(dbPath, maxRows) {
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        server_received  INTEGER NOT NULL,
        ts               INTEGER NOT NULL,
        flow_rate_lpm    REAL    NOT NULL,
        turbidity_raw    INTEGER NOT NULL,
        turbidity_ntu    REAL,
        pump_on          INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recv ON readings(server_received DESC);
    `);
    usingDb = true;
    console.log(`[STORAGE] SQLite ready → ${dbPath}`);
    return true;
  } catch (err) {
    console.warn(`[STORAGE] better-sqlite3 unavailable (${err.message}). Using in-memory store.`);
    console.warn('[STORAGE] Data will not survive process restarts in this mode.');
    usingDb = false;
    return false;
  }
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memStore = [];

// ─── Row ↔ reading conversion ─────────────────────────────────────────────────

function rowToReading(row) {
  return {
    timestamp:         row.ts,
    serverReceivedAt:  row.server_received,
    source:            'HARDWARE',
    flowRateLpm:       row.flow_rate_lpm,
    turbidityRaw:      row.turbidity_raw,
    turbidityNTU:      row.turbidity_ntu ?? null,
    pumpOn:            row.pump_on === 1 || row.pump_on === true,
    groundwaterDepthM: null,
    sensorStatus: {
      groundwaterDepth: 'UNAVAILABLE',
      flowRate:  'OK',
      turbidity: 'OK',
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise storage. Call once at startup.
 * @param {string} dbPath   - Filesystem path for SQLite DB
 * @param {number} maxRows  - Maximum rows to retain
 */
function init(dbPath, maxRows) {
  tryOpenSqlite(dbPath, maxRows);

  // Pre-load latest reading so status is correct immediately after restart
  if (usingDb && db) {
    try {
      const row = db.prepare(
        'SELECT * FROM readings ORDER BY server_received DESC LIMIT 1'
      ).get();
      if (row) {
        const r = rowToReading(row);
        console.log(`[STORAGE] Restored latest reading from ${new Date(row.server_received).toISOString()}`);
        return r;
      }
    } catch (e) {
      console.warn('[STORAGE] Could not restore latest reading:', e.message);
    }
  }
  return null;
}

/**
 * Persist a validated reading. Returns the reading unchanged.
 * @param {object} reading  - Validated reading object from validatePayload()
 * @param {number} maxRows
 */
function insert(reading, maxRows) {
  if (usingDb && db) {
    try {
      db.prepare(`
        INSERT INTO readings (server_received, ts, flow_rate_lpm, turbidity_raw, turbidity_ntu, pump_on)
        VALUES (@serverReceivedAt, @timestamp, @flowRateLpm, @turbidityRaw, @turbidityNTU, @pumpOn)
      `).run({
        serverReceivedAt: reading.serverReceivedAt,
        timestamp:        reading.timestamp,
        flowRateLpm:      reading.flowRateLpm,
        turbidityRaw:     reading.turbidityRaw,
        turbidityNTU:     reading.turbidityNTU,
        pumpOn:           reading.pumpOn ? 1 : 0,
      });
      // Prune to maxRows
      db.prepare(
        `DELETE FROM readings WHERE id NOT IN
         (SELECT id FROM readings ORDER BY server_received DESC LIMIT ?)`
      ).run(maxRows);
    } catch (err) {
      console.error('[STORAGE] Insert error:', err.message);
    }
  } else {
    // In-memory ring buffer
    memStore.push({ ...reading });
    if (memStore.length > maxRows) memStore.shift();
  }
  return reading;
}

/**
 * Return up to `limit` readings in chronological order.
 * @param {number} limit
 */
function getHistory(limit) {
  if (usingDb && db) {
    try {
      const rows = db.prepare(
        'SELECT * FROM readings ORDER BY server_received DESC LIMIT ?'
      ).all(limit).reverse();
      return rows.map(rowToReading);
    } catch (err) {
      console.error('[STORAGE] History query error:', err.message);
      return [];
    }
  }
  return memStore.slice(-limit);
}

/**
 * Return total reading count.
 */
function count() {
  if (usingDb && db) {
    try {
      return db.prepare('SELECT COUNT(*) as c FROM readings').get().c;
    } catch { return 0; }
  }
  return memStore.length;
}

function storageType() {
  return usingDb ? 'sqlite' : 'in-memory';
}

module.exports = { init, insert, getHistory, count, storageType };
