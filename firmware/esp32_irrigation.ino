/*
  ESP32-CAM Precision Irrigation Firmware
  ---------------------------------------
  Hardware: ESP32-CAM (AI-Thinker) + Capacitive Moisture Sensor
  Function: 
  1. Reads soil moisture from Analog Pin.
  2. Captures soil image using Camera.
  3. Sends data to the Smart Irrigation Web API.
  4. Receives watering commands to trigger a relay/pump.
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://YOUR_APP_URL/api/hardware";

const int sensorPin = 34; // Analog pin for moisture sensor
const int relayPin = 4;   // Pin for water pump relay (using Flash LED pin for demo)

void setup() {
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT);
  digitalWrite(relayPin, LOW);

  // WiFi Setup
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Camera Setup (AI-Thinker Pins)
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sscb_sda = 26;
  config.pin_sscb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    sendMoisture();
    delay(5000); // Wait 5s before next check
    
    // Every 1 hour, send an image for AI analysis
    static unsigned long lastImageTime = 0;
    if (millis() - lastImageTime > 3600000) {
      sendImage();
      lastImageTime = millis();
    }
  }
  delay(1000);
}

void sendMoisture() {
  int rawValue = analogRead(sensorPin);
  int moisturePercent = map(rawValue, 4095, 1500, 0, 100); // Calibrate for your sensor
  moisturePercent = constrain(moisturePercent, 0, 100);

  HTTPClient http;
  http.begin(String(serverUrl) + "/moisture");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["moisture"] = moisturePercent;
  String json;
  serializeJson(doc, json);

  int httpCode = http.POST(json);
  if (httpCode > 0) {
    String response = http.getString();
    StaticJsonDocument<200> resDoc;
    deserializeJson(resDoc, response);
    
    if (resDoc["command"] == true) {
      Serial.println("Watering command received!");
      digitalWrite(relayPin, HIGH);
      delay(5000); // Water for 5 seconds
      digitalWrite(relayPin, LOW);
    }
  }
  http.end();
}

void sendImage() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  HTTPClient http;
  http.begin(String(serverUrl) + "/image");
  http.addHeader("Content-Type", "application/json");

  // Base64 encode image
  String base64Image = base64::encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  StaticJsonDocument<20000> doc; // Adjust size for base64 string
  doc["image"] = base64Image;
  String json;
  serializeJson(doc, json);

  int httpCode = http.POST(json);
  http.end();
}
