/**
 * ============================================================
 * Smart Aquifer Sentinel — ESP32 Firmware  v1.2.0
 * ============================================================
 *
 * Reads a water-flow sensor and a turbidity sensor, then POSTs
 * readings to the backend (local laptop or production server).
 *
 * ALL CREDENTIALS LIVE IN secrets.h — NOT IN THIS FILE.
 * Copy secrets.h.example → secrets.h and fill it in.
 * secrets.h is git-ignored and will never be committed.
 *
 * SENSORS:
 *   Flow     : YF-S201 (or compatible) — hall-effect pulse output
 *   Turbidity: Analog turbidity sensor  — ADC1 pin (3.3 V max)
 *
 * BEFORE UPLOADING:
 *   1. Copy secrets.h.example → secrets.h, fill in Wi-Fi + IP + token
 *   2. Verify FLOW_SENSOR_PIN and TURBIDITY_PIN match your wiring
 *   3. Calibrate PULSES_PER_LITRE for your specific sensor
 *   4. See WIRING_AND_SETUP.md for voltage-safety notes
 *
 * Board    : ESP32 Dev Module (WROOM-32, NodeMCU-32S, etc.)
 * IDE      : Arduino IDE 2.x
 * ESP32 core: 2.x or 3.x
 * Libraries: ArduinoJson by Benoit Blanchon  (Library Manager)
 *            WiFiClientSecure — included with ESP32 core
 * ============================================================
 */

#include "secrets.h"           // Wi-Fi, API host, port, token, USE_HTTPS flag
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#if USE_HTTPS
  #include <WiFiClientSecure.h>
#endif

// ─── Hardware pin assignments ────────────────────────────────────────────────
// VERIFY THESE AGAINST YOUR WIRING before uploading.
// See WIRING_AND_SETUP.md for voltage-safety guidance.

const int FLOW_SENSOR_PIN = 18;   // Pulse output. Use voltage divider if sensor is 5 V.
const int TURBIDITY_PIN   = 34;   // ADC1 pin only (GPIO 34/35/36/39). 3.3 V max.

// Set to a GPIO that mirrors your pump relay state, or -1 if not wired.
// -1 means pump is always reported as ON.
const int PUMP_PIN = -1;

// ─── Flow sensor calibration ─────────────────────────────────────────────────
// YF-S201 datasheet: ~7.5 pulses/second at 1 L/min → 450 pulses/litre.
// To calibrate yours: collect water for a known time, count Serial pulses,
// then: PULSES_PER_LITRE = total_pulses / litres_collected
const float PULSES_PER_LITRE = 450.0f;

// ─── Timing ──────────────────────────────────────────────────────────────────
const unsigned long POST_INTERVAL_MS = 2000;   // POST every 2 seconds

// ─── Globals ─────────────────────────────────────────────────────────────────
volatile uint32_t pulseCount = 0;   // written by interrupt — must be volatile
unsigned long     lastPostMs = 0;

// ─── ISR ─────────────────────────────────────────────────────────────────────
// IRAM_ATTR runs the ISR from fast RAM, not flash — required for reliability.
void IRAM_ATTR onFlowPulse() {
  pulseCount++;
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Smart Aquifer Sentinel v1.2 ===");
  Serial.printf("Target : %s://%s:%d\n", USE_HTTPS ? "https" : "http", API_HOST, API_PORT);

  // Flow sensor interrupt
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), onFlowPulse, RISING);

  // Optional pump state pin
  if (PUMP_PIN >= 0) pinMode(PUMP_PIN, INPUT_PULLUP);

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("Wi-Fi : connecting to %s", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi : connected. ESP32 IP = %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWi-Fi : not connected after 30 s — will retry in loop.");
  }

  lastPostMs = millis();
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] Wi-Fi lost — reconnecting...");
    WiFi.reconnect();
    delay(3000);
    return;
  }

  // Only POST on the configured interval
  if (now - lastPostMs < POST_INTERVAL_MS) return;
  lastPostMs = now;

  // ── Read flow sensor ──────────────────────────────────────────────────────
  // Temporarily detach interrupt to read pulseCount atomically.
  detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
  uint32_t pulses = pulseCount;
  pulseCount = 0;
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), onFlowPulse, RISING);

  float elapsedSec = POST_INTERVAL_MS / 1000.0f;
  // L/min = (pulses ÷ pulses-per-litre) ÷ elapsed-seconds × 60
  float flowLpm = (float)pulses / PULSES_PER_LITRE / elapsedSec * 60.0f;
  if (flowLpm < 0.0f) flowLpm = 0.0f;

  // ── Read turbidity sensor (16-sample average to reduce noise) ─────────────
  long adcSum = 0;
  for (int i = 0; i < 16; i++) {
    adcSum += analogRead(TURBIDITY_PIN);
    delayMicroseconds(200);
  }
  int turbRaw = constrain((int)(adcSum / 16), 0, 4095);

  // ── Read pump state ───────────────────────────────────────────────────────
  bool pumpOn = (PUMP_PIN >= 0) ? (digitalRead(PUMP_PIN) == HIGH) : true;

  // ── Build JSON payload ────────────────────────────────────────────────────
  StaticJsonDocument<256> doc;
  doc["source"]       = "hardware";
  doc["flowRateLpm"]  = serialized(String(flowLpm, 3));
  doc["turbidityRaw"] = turbRaw;
  doc["pumpOn"]       = pumpOn;
  // Add turbidityNTU only after you have a calibrated conversion:
  //   doc["turbidityNTU"] = myCalibration(turbRaw);

  char jsonBuf[256];
  serializeJson(doc, jsonBuf);

  // ── HTTP(S) POST ──────────────────────────────────────────────────────────
  HTTPClient http;

#if USE_HTTPS
  // HTTPS path — skips certificate verification (acceptable for prototype)
  // For stricter security supply a CA cert via client.setCACert(pem)
  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  String url = String("https://") + API_HOST + "/api/telemetry";
  http.begin(secureClient, url);
  Serial.println("[WARN] TLS cert verification is disabled (USE_HTTPS with setInsecure)");
#else
  // HTTP path — plain text, fine on your own LAN / phone hotspot
  String url = String("http://") + API_HOST + ":" + API_PORT + "/api/telemetry";
  http.begin(url);
#endif

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", API_AUTH_TOKEN);
  http.setTimeout(6000);

  Serial.printf("[POST] %s  flow=%.2f L/min  turbRaw=%d  pump=%s\n",
    url.c_str(), flowLpm, turbRaw, pumpOn ? "ON" : "OFF");

  int httpCode = http.POST(jsonBuf);

  if (httpCode == 200) {
    Serial.println("[POST] OK");
  } else if (httpCode == 401) {
    Serial.println("[POST] 401 Unauthorized — API_AUTH_TOKEN in secrets.h does not match server DEVICE_AUTH_TOKEN");
  } else if (httpCode == 400) {
    String body = http.getString();
    Serial.printf("[POST] 400 Bad Request — %s\n", body.c_str());
  } else if (httpCode > 0) {
    Serial.printf("[POST] HTTP %d\n", httpCode);
  } else {
    Serial.printf("[POST] FAIL — %s\n", http.errorToString(httpCode).c_str());
    Serial.println("       Check: laptop IP correct? Backend running? Same Wi-Fi?");
  }

  http.end();
}
