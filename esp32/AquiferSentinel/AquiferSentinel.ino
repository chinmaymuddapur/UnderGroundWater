/**
 * ============================================================
 * Smart Aquifer Sentinel — ESP32 Firmware  v1.1.0
 * ============================================================
 *
 * Posts sensor readings to the PRODUCTION backend over HTTPS.
 *
 * SENSORS:
 *   - Water-flow sensor  : YF-S201 (pulse output) → GPIO interrupt
 *   - Turbidity sensor   : Analog output           → ADC1 pin
 *
 * BEFORE UPLOADING — fill in every value marked <REPLACE>:
 *   1. WIFI_SSID / WIFI_PASS       — your Wi-Fi network
 *   2. API_HOST                    — your Render backend hostname
 *                                    e.g. "aquifer-sentinel-api.onrender.com"
 *   3. API_AUTH_TOKEN              — the DEVICE_AUTH_TOKEN you set on Render
 *   4. FLOW_SENSOR_PIN             — verify against your wiring
 *   5. TURBIDITY_PIN               — must be an ADC1 pin (see WIRING_AND_SETUP.md)
 *   6. PULSES_PER_LITRE            — calibrate for your specific sensor
 *
 * DO NOT commit this file with real credentials filled in.
 * Use a local config file and keep it out of version control.
 *
 * Board : ESP32 Dev Module  |  Arduino IDE 2.x  |  ESP32 core 2.x / 3.x
 * Libs  : ArduinoJson by Benoit Blanchon (install via Library Manager)
 *         WiFiClientSecure (included with ESP32 core)
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ─── USER CONFIGURATION ──────────────────────────────────────────────────────

// Wi-Fi — never commit real credentials
const char* WIFI_SSID = "<REPLACE: your Wi-Fi SSID>";
const char* WIFI_PASS = "<REPLACE: your Wi-Fi password>";

// Production backend — Render free tier hostname (no trailing slash, no https://)
const char* API_HOST  = "<REPLACE: e.g. aquifer-sentinel-api.onrender.com>";
const int   API_PORT  = 443;   // HTTPS

// Device authentication token — must match DEVICE_AUTH_TOKEN on the server.
// Generate once on the server:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Set it in Render environment variables, then paste the SAME value here.
const char* API_AUTH_TOKEN = "<REPLACE: your device auth token>";

// GPIO pins — VERIFY BEFORE UPLOADING (see WIRING_AND_SETUP.md for voltage safety)
const int FLOW_SENSOR_PIN = 18;   // Pulse output — use voltage divider if 5 V sensor
const int TURBIDITY_PIN   = 34;   // ADC1 only (GPIO 34/35/36/39) — 3.3 V max

// Flow calibration — YF-S201 default; measure and adjust for your sensor
const float PULSES_PER_LITRE = 450.0f;

// Pump state pin (-1 = not wired, reports pump=true always)
const int PUMP_PIN = -1;

// How often to POST (ms)
const unsigned long POST_INTERVAL_MS = 2000;

// ─── TLS: Accept Render's Let's Encrypt certificate ──────────────────────────
// Using setInsecure() skips certificate verification — acceptable for a
// competition prototype. For a production system, load the actual root CA cert.
// See: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html
// To use full verification: replace setInsecure() with client.setCACert(root_ca)
// and provide the ISRG Root X1 PEM.
#define USE_INSECURE_TLS true   // set false and add CA cert for stricter security

// ─── Globals ─────────────────────────────────────────────────────────────────

volatile uint32_t pulseCount = 0;
unsigned long lastPostMs = 0;

// ─── Interrupt ───────────────────────────────────────────────────────────────

void IRAM_ATTR onFlowPulse() {
  pulseCount++;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Smart Aquifer Sentinel v1.1 ===");

  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), onFlowPulse, RISING);
  if (PUMP_PIN >= 0) pinMode(PUMP_PIN, INPUT_PULLUP);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("Connecting to %s", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts++ < 30) {
    delay(1000);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WARN] Wi-Fi not connected — will retry in loop.");
  }

  lastPostMs = millis();
}

// ─── Loop ────────────────────────────────────────────────────────────────────

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] Wi-Fi lost, reconnecting...");
    WiFi.reconnect();
    delay(3000);
    return;
  }

  if (now - lastPostMs < POST_INTERVAL_MS) return;
  lastPostMs = now;

  // ── Read flow sensor ────────────────────────────────────────────────────
  detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
  uint32_t pulses = pulseCount;
  pulseCount = 0;
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), onFlowPulse, RISING);

  float elapsedSec = POST_INTERVAL_MS / 1000.0f;
  float flowLpm = max(0.0f, (pulses / PULSES_PER_LITRE) / elapsedSec * 60.0f);

  // ── Read turbidity (averaged ADC) ───────────────────────────────────────
  long sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(TURBIDITY_PIN); delayMicroseconds(200); }
  int turbRaw = constrain((int)(sum / 16), 0, 4095);

  // ── Pump state ──────────────────────────────────────────────────────────
  bool pumpOn = (PUMP_PIN >= 0) ? (digitalRead(PUMP_PIN) == HIGH) : true;

  // ── Build JSON ──────────────────────────────────────────────────────────
  StaticJsonDocument<256> doc;
  doc["source"]       = "hardware";
  doc["flowRateLpm"]  = serialized(String(flowLpm, 3));
  doc["turbidityRaw"] = turbRaw;
  doc["pumpOn"]       = pumpOn;
  // Omit turbidityNTU until you have a calibrated conversion:
  //   doc["turbidityNTU"] = calibratedNtu(turbRaw);

  char buf[256];
  serializeJson(doc, buf);

  // ── HTTPS POST ──────────────────────────────────────────────────────────
  WiFiClientSecure client;
#if USE_INSECURE_TLS
  client.setInsecure();   // skip cert verification — OK for prototype
#endif

  HTTPClient http;
  String url = String("https://") + API_HOST + "/api/telemetry";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", API_AUTH_TOKEN);
  http.setTimeout(8000);

  int code = http.POST(buf);

  if (code == 200) {
    Serial.printf("[OK] flow=%.2f L/min  turbRaw=%d  pump=%s\n",
                  flowLpm, turbRaw, pumpOn ? "ON" : "OFF");
  } else if (code == 401) {
    Serial.println("[ERR] 401 Unauthorized — check API_AUTH_TOKEN matches server DEVICE_AUTH_TOKEN");
  } else if (code > 0) {
    Serial.printf("[ERR] HTTP %d\n", code);
  } else {
    Serial.printf("[FAIL] %s\n", http.errorToString(code).c_str());
  }

  http.end();
}
