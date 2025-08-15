#include <SPI.h>
#include <LoRa.h>

// ---------------- LoRa Pin Definitions (ESP32) ----------------
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_CS    5
#define LORA_RST   14
#define LORA_IRQ   2
#define LORA_BAND  500E6  // Match sender frequency

// ---------------- Setup ----------------
void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 LoRa Receiver with Reply Capability");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
  Serial.println("LoRa initialized successfully!");
}

// ---------------- Function to Send Message ----------------
void sendLoRaMessage(String data) {
  LoRa.beginPacket();
  LoRa.print(data);
  LoRa.endPacket();
}

// ---------------- Main Loop ----------------
void loop() {
  // ----- Check for incoming LoRa packets -----
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    Serial.println("Received: " + incoming);
  }

  // ----- Check if we have a reply from Serial -----
  if (Serial.available()) {
    String reply = Serial.readStringUntil('\n');
    reply.trim();
    if (reply.length() > 0) {
      String packet = reply;
      Serial.println(reply);
      sendLoRaMessage(packet);
    }
  }
}
