#include <SPI.h>
#include <LoRa.h>
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_CS     5
#define LORA_RST   14
#define LORA_IRQ    2

#define LORA_BAND  433E6  

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("LoRa Sender");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }

  Serial.println("LoRa Initializing OK!");
} 

void loop() {
  Serial.println("Sending message: Hello");

  LoRa.beginPacket();
  LoRa.print("Hello, My name is Bishwojit prasad shah. i am here in Jhapa to participate in Hackathon");
  LoRa.endPacket();
}
