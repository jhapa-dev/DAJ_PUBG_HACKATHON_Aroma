#include <SPI.h>
#include <LoRa.h>
#include <NMEAGPS.h>

// ---------------- LoRa Pin Definitions (ESP32) ----------------
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_CS    5
#define LORA_RST   14
#define LORA_IRQ   2
#define LORA_BAND  433E6

// ---------------- GPS Pins ----------------
#define GPS_RX 16  // GPS TX -> ESP32 RX
#define GPS_TX 17  // GPS RX -> ESP32 TX

// ---------------- GPS & LoRa Objects ----------------
NMEAGPS gps;
gps_fix fix;

// ---------------- Motion Filter Settings ----------------
#define STATIONARY_SPEED_MPS 0.3   // ~1 km/h
#define STATIONARY_ENTER_SEC 10    // Time below speed to enter stationary
#define STATIONARY_EXIT_M    20.0  // Distance from anchor to exit stationary

// ---------------- Variables ----------------
enum MotionState { MOVING, STATIONARY };
MotionState state = MOVING;

unsigned long stationaryStartMs = 0;
float anchorLat = 0.0, anchorLon = 0.0;

// ---------------- Simple Moving Average Filter ----------------
const int AVG_COUNT = 5;   // Number of samples to average
float latBuf[AVG_COUNT];
float lonBuf[AVG_COUNT];
int bufIndex = 0;
bool bufFilled = false;

// ---------------- Haversine Function (meters) ----------------
float haversineM(float lat1, float lon1, float lat2, float lon2) {
  const float R = 6371000.0; // Earth radius in meters
  float dLat = radians(lat2 - lat1);
  float dLon = radians(lon2 - lon1);
  float a = sin(dLat/2) * sin(dLat/2) +
            cos(radians(lat1)) * cos(radians(lat2)) *
            sin(dLon/2) * sin(dLon/2);
  float c = 2 * atan2(sqrt(a), sqrt(1-a));
  return R * c;
}

// ---------------- Averaging ----------------
void addToBuffer(float lat, float lon) {
  latBuf[bufIndex] = lat;
  lonBuf[bufIndex] = lon;
  bufIndex = (bufIndex + 1) % AVG_COUNT;
  if (bufIndex == 0) bufFilled = true;
}

void getAveraged(float &lat, float &lon) {
  int count = bufFilled ? AVG_COUNT : bufIndex;
  float sumLat = 0.0, sumLon = 0.0;
  for (int i = 0; i < count; i++) {
    sumLat += latBuf[i];
    sumLon += lonBuf[i];
  }
  lat = sumLat / count;
  lon = sumLon / count;
}

// ---------------- Setup ----------------
void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 LoRa GPS Sender");

  // GPS Serial
  Serial2.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  // LoRa
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
  Serial.println("LoRa & GPS initialized successfully!");
}

// ---------------- Main Loop ----------------
void loop() {
  while (gps.available(Serial2)) {
    fix = gps.read();

    if (fix.valid.location) {
      float lat = fix.latitude();
      float lon = fix.longitude();

      // Add raw to buffer and get smoothed position
      addToBuffer(lat, lon);
      getAveraged(lat, lon);

      bool lowSpeed = (fix.valid.speed && ((fix.speed_kph() / 3.6) <= STATIONARY_SPEED_MPS));

      if (state == MOVING) {
        if (lowSpeed) {
          if (stationaryStartMs == 0) stationaryStartMs = millis();
          if (millis() - stationaryStartMs >= STATIONARY_ENTER_SEC * 1000UL) {
            state = STATIONARY;
            anchorLat = lat;
            anchorLon = lon;
            Serial.println("State -> STATIONARY (lock)");
          }
        } else {
          stationaryStartMs = 0;
        }

      } else { // STATIONARY
        float dFromAnchor = haversineM(anchorLat, anchorLon, lat, lon);
        bool highSpeed = (fix.valid.speed && ((fix.speed_kph() / 3.6) > STATIONARY_SPEED_MPS));

        if (dFromAnchor >= STATIONARY_EXIT_M && highSpeed) {
          state = MOVING;
          stationaryStartMs = 0;
          Serial.println("State -> MOVING (unlock)");
        } else {
          // Force output to anchor to prevent jitter
          lat = anchorLat;
          lon = anchorLon;
        }
      }

      // Build message
      String message = String(lat, 6) + "," + String(lon, 6);
      if (fix.valid.altitude) {
        message += "," + String(fix.altitude(), 2) + " m";
      }
      if (fix.valid.time) {
        char timeStr[10];
        sprintf(timeStr, "%02d:%02d", fix.dateTime.hours, fix.dateTime.minutes);
        message += "," + String(timeStr);
      }

      Serial.println("Sending: " + message);
      LoRa.beginPacket();
      LoRa.print(message);
      LoRa.endPacket();
    }
  }
}
