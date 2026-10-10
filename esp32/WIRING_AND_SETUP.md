# Smart Aquifer Sentinel — ESP32 Wiring & Setup Guide

## ⚠ IMPORTANT VOLTAGE SAFETY

**ESP32 GPIO pins operate at 3.3 V logic. Do not connect a 5 V signal directly.**

Exceeding 3.3 V on any GPIO pin can permanently damage the ESP32.

| Signal type | Safe connection method |
|-------------|------------------------|
| 3.3 V sensor output | Direct connection OK |
| 5 V sensor output | Use a voltage divider (e.g. 1 kΩ + 2 kΩ) or a level-shifter module |
| 5 V sensor VCC | Power from 5 V pin on board if available; ESP32 itself still 3.3 V |

---

## Hardware Required

| Component | Notes |
|-----------|-------|
| ESP32 development board | NodeMCU-32S, WROOM-32, or equivalent |
| YF-S201 water flow sensor (or compatible) | Hall-effect pulse output |
| Analog turbidity sensor | e.g. DFRobot SEN0189 or similar |
| Laptop on same Wi-Fi | Running the Node.js backend |
| USB cable | For programming and power |

---

## Flow Sensor Wiring (YF-S201 example)

```
YF-S201 Pin  →  ESP32 Pin
VCC          →  5V (or 3.3V if sensor supports it — check datasheet)
GND          →  GND
Signal (OUT) →  GPIO 18  via voltage divider if 5V output:
                  GPIO18 ←─ 2 kΩ ─┬─ Signal
                               1 kΩ
                                 │
                                GND
```

**Calibration:** The default `PULSES_PER_LITRE = 450` is typical for YF-S201 at low flow rates. To calibrate:
1. Run water through the sensor into a measuring container for a known time.
2. Count the pulses (print to Serial).
3. Calculate: `PULSES_PER_LITRE = total_pulses / litres_collected`.
4. Update the constant in `AquiferSentinel.ino` and re-upload.

---

## Turbidity Sensor Wiring

```
Sensor Pin   →  ESP32 Pin
VCC          →  5V  (most turbidity sensor boards need 5 V supply)
GND          →  GND
Signal (OUT) →  GPIO 34  (ADC input, 0–3.3 V ONLY)

⚠ If the sensor output swings to 5 V:
  Use a voltage divider before GPIO 34:
    GPIO34 ←─ 2 kΩ ─┬─ Sensor OUT
                 1 kΩ
                   │
                  GND
```

**Choosing an ADC pin:**
- GPIO 34, 35, 36, 39 are input-only ADC1 pins on most ESP32 boards.
- Avoid ADC2 pins (GPIO 0, 2, 4, 12–15, 25–27) when using Wi-Fi — ADC2 is shared with the Wi-Fi radio and gives unreliable readings.

**About raw ADC values:**
- The firmware sends `turbidityRaw` (0–4095, 12-bit).
- The backend stores it unchanged.
- The frontend converts it to an **approximate** NTU value for display.
- For accurate NTU readings, calibrate the sensor against known NTU reference standards and add the conversion to the firmware's `turbidityNTU` field.

---

## Groundwater Depth

No ultrasonic or pressure sensor is currently connected.
`groundwaterDepthM` will remain `null` / **UNAVAILABLE** in the dashboard.

To add depth measurement later:
1. Connect an HC-SR04 ultrasonic sensor (use 3.3 V tolerant version or level-shifter for 5 V Echo pin).
2. Add the distance measurement to the firmware.
3. Add `"groundwaterDepthM"` to the POST payload.
4. Update the backend validation in `server/index.js` to accept it.

---

## Software Setup

### 1. Arduino IDE Libraries Required

Install via **Tools → Manage Libraries**:

| Library | Author |
|---------|--------|
| ArduinoJson | Benoit Blanchon (version 6.x) |

The `WiFi.h` and `HTTPClient.h` libraries are included with the ESP32 Arduino core.

### 2. Install ESP32 Board Support

In Arduino IDE → **File → Preferences → Additional Board Manager URLs**, add:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
Then **Tools → Board → Board Manager → search "esp32"** → install "esp32 by Espressif".

### 3. Configure the sketch

Edit `AquiferSentinel.ino`:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* LAPTOP_IP = "192.168.X.X";   // from ipconfig on Windows
```

### 4. Find laptop LAN IP (Windows)

Open PowerShell and run:
```powershell
ipconfig
```
Look for the section matching your Wi-Fi adapter:
```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.1.42   ← use this
```

### 5. Start the backend

In a terminal at the project root:
```powershell
npm run server
```
Expected output:
```
╔══════════════════════════════════════════════╗
║   Smart Aquifer Sentinel — Backend v1.0.0   ║
╚══════════════════════════════════════════════╝
  Listening on  : http://0.0.0.0:3001
```

### 6. Start the frontend

In a separate terminal:
```powershell
npm run dev
```
Open: http://localhost:5173

### 7. Test without ESP32 (PowerShell)

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/telemetry `
  -Method POST `
  -ContentType 'application/json' `
  -Body '{"source":"hardware","flowRateLpm":18.5,"turbidityRaw":2100,"pumpOn":true}'
```
Expected response: `{ ok: true, ts: <timestamp> }`

Check health:
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/health
```

### 8. Switch to Hardware Mode in dashboard

1. Open http://localhost:5173
2. Navigate to **Settings**
3. Click **Hardware Mode**
4. Upload the sketch to ESP32 — readings appear immediately

---

## Complete Connection Checklist

- [ ] ESP32 and laptop on **same Wi-Fi network** (or mobile hotspot)
- [ ] `LAPTOP_IP` set to laptop's IPv4 address (not 127.0.0.1)
- [ ] Voltage dividers / level-shifters in place for 5 V sensor outputs
- [ ] Flow sensor signal connected to GPIO 18 (or updated `FLOW_SENSOR_PIN`)
- [ ] Turbidity output connected to GPIO 34 (or updated `TURBIDITY_PIN`, ADC1 only)
- [ ] Backend running: `npm run server`
- [ ] Frontend running: `npm run dev`
- [ ] Dashboard set to **Hardware Mode**
- [ ] Serial Monitor open (115200 baud) to see POST confirmations on ESP32

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| ESP32 prints `[POST FAIL] Connection refused` | Backend not running | Run `npm run server` |
| ESP32 prints `[POST FAIL] No route to host` | Wrong `LAPTOP_IP` | Run `ipconfig`, update sketch |
| Dashboard stuck on NOT CONNECTED | Backend running but no ESP32 | Test with PowerShell command above |
| Flow always 0 L/min | Wrong GPIO, interrupt not firing | Check wiring; print `pulseCount` in loop |
| Turbidity always 0 or 4095 | Sensor voltage out of range | Check power supply; add voltage divider |
| ADC readings noisy | ADC2 pin used with Wi-Fi | Move to ADC1 pin (GPIO 34, 35, 36, 39) |
