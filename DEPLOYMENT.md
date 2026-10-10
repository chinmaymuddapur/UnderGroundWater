# Smart Aquifer Sentinel — Production Deployment Guide

## Architecture

```
ESP32 sensors
    │ HTTPS POST /api/telemetry (X-Device-Token header)
    ▼
Render Web Service  (Node.js backend — port assigned by Render)
    │  GET /api/telemetry/latest  (polled every 2 s by frontend)
    ▼
Netlify  (React + Vite static site)
    │  VITE_API_BASE_URL = https://aquifer-sentinel-api.onrender.com
    ▼
Browser dashboard
```

---

## Part 1 — Generate a Device Auth Token

Run this once on your laptop. **Save the output — you need it in two places.**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output (yours will differ):
```
a3f8c2d1e4b7a09f3c5d6e2f1a8b4c7d0e9f2a5b8c1d4e7f0a3b6c9d2e5f8a1
```

---

## Part 2 — Deploy the Backend to Render

### 2.1 — Prerequisites
- Free account at https://render.com
- This repository pushed to GitHub or GitLab

### 2.2 — Create a Web Service
1. Render dashboard → **New → Web Service**
2. Connect your repository
3. Configure:
   - **Name**: `aquifer-sentinel-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### 2.3 — Add a Persistent Disk (for SQLite)
1. In the service settings → **Disks → Add Disk**
2. Name: `telemetry-db`
3. Mount Path: `/data`
4. Size: 1 GB

### 2.4 — Set Environment Variables (Render dashboard → Environment)

| Variable | Value |
|----------|-------|
| `DEVICE_AUTH_TOKEN` | The token you generated in Part 1 |
| `ALLOWED_ORIGINS` | `https://your-app.netlify.app` *(fill in after Netlify deploy)* |
| `DB_PATH` | `/data/telemetry.db` |
| `STALE_THRESHOLD_SECONDS` | `15` |
| `MAX_HISTORY_ROWS` | `300` |

> **Important:** Set `ALLOWED_ORIGINS` to your actual Netlify URL after step 3.
> Until then, set it to `*` temporarily to unblock testing, then lock it down.

### 2.5 — Verify the backend is live

After Render deploys (2–3 minutes):
```
https://aquifer-sentinel-api.onrender.com/api/health
```

Expected response:
```json
{ "ok": true, "storage": "sqlite", "deviceConnected": false, ... }
```

Your backend URL (e.g. `https://aquifer-sentinel-api.onrender.com`) is needed in Parts 3 and 4.

---

## Part 3 — Deploy the Frontend to Netlify

### 3.1 — Prerequisites
- Free account at https://netlify.com

### 3.2 — Deploy from Git
1. Netlify dashboard → **Add new site → Import an existing project**
2. Connect repository
3. Configure:
   - **Base directory**: *(leave empty — root)*
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

   Netlify reads `netlify.toml` automatically — these are already set correctly.

### 3.3 — Set Environment Variables (Netlify → Site settings → Environment variables)

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://aquifer-sentinel-api.onrender.com` |

> `VITE_` prefix is required. Vite only exposes variables with this prefix to the browser bundle.
> This URL is **not a secret** — it goes into the browser bundle. Never put `DEVICE_AUTH_TOKEN` here.

### 3.4 — Trigger a redeploy
After setting the environment variable, trigger a new deploy so the build picks it up:
Netlify → **Deploys → Trigger deploy → Deploy site**

### 3.5 — Update CORS on Render
Once you have your Netlify URL (e.g. `https://aquifer-sentinel.netlify.app`):
1. Go to Render → Environment variables
2. Set `ALLOWED_ORIGINS` = `https://aquifer-sentinel.netlify.app`
3. Render will restart the service automatically

---

## Part 4 — Configure the ESP32 Sketch

Open `esp32/AquiferSentinel/AquiferSentinel.ino` and fill in:

```cpp
const char* WIFI_SSID      = "YourNetworkName";
const char* WIFI_PASS      = "YourNetworkPassword";
const char* API_HOST       = "aquifer-sentinel-api.onrender.com";  // no https://
const char* API_AUTH_TOKEN = "a3f8c2d1e4b7...";  // token from Part 1
```

Upload to ESP32. Open Serial Monitor (115200 baud). You should see:
```
[OK] flow=0.00 L/min  turbRaw=2048  pump=ON
```

---

## Part 5 — Switch Dashboard to Hardware Mode

1. Open your Netlify site
2. Navigate to **Settings**
3. Click **Hardware Mode**
4. The metric cards update to show real sensor data within 2–4 seconds
5. The TopBar shows **HARDWARE CONNECTED** in green

---

## Local Development (unchanged)

```powershell
# Terminal 1 — frontend
npm run dev           # http://localhost:5173

# Terminal 2 — backend (local, uses in-memory storage)
$env:DEVICE_AUTH_TOKEN="any-local-test-token"
$env:ALLOWED_ORIGINS="http://localhost:5173"
npm run server
```

Test locally without ESP32:
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/telemetry `
  -Method POST -ContentType "application/json" `
  -Headers @{"X-Device-Token"="any-local-test-token"} `
  -Body '{"source":"hardware","flowRateLpm":18.5,"turbidityRaw":2100,"pumpOn":true}'
```

---

## What Requires Manual Steps

| Step | Requires your account |
|------|-----------------------|
| Create Render web service | ✅ Manual — render.com |
| Set Render env vars (`DEVICE_AUTH_TOKEN`, etc.) | ✅ Manual |
| Add Render persistent disk | ✅ Manual |
| Create Netlify site | ✅ Manual — netlify.com |
| Set `VITE_API_BASE_URL` in Netlify | ✅ Manual |
| Trigger Netlify redeploy after env var | ✅ Manual |
| Upload ESP32 sketch | ✅ Manual — Arduino IDE |
| All code, config files, scripts | ✅ Already done |

---

## Security Summary

| Concern | How it's handled |
|---------|-----------------|
| ESP32 → backend | HTTPS + `X-Device-Token` header (server rejects any other origin) |
| Auth token in frontend | **Never** — token is only in the ESP32 sketch and Render env vars |
| CORS | Locked to your Netlify URL via `ALLOWED_ORIGINS` |
| Input validation | Every field range-checked; simulation source explicitly rejected |
| Secrets in Git | `.gitignore` excludes all `.env*` files and `*.db` files |
| Groundwater depth | Always `null` / UNAVAILABLE — never fabricated from other sensors |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| ESP32: `[ERR] 401 Unauthorized` | `API_AUTH_TOKEN` in sketch ≠ `DEVICE_AUTH_TOKEN` on Render |
| Dashboard: `Cannot reach backend` | Check `VITE_API_BASE_URL` in Netlify env vars; redeploy |
| Render health shows `storage: in-memory` | Disk not mounted at `/data`; add disk in Render settings |
| CORS error in browser console | `ALLOWED_ORIGINS` on Render doesn't match Netlify URL exactly |
| ESP32: `[FAIL] connection refused` | `API_HOST` has `https://` prefix — remove it, hostname only |
| Netlify build fails | Check `NODE_VERSION=20` in `netlify.toml`; check build logs |
