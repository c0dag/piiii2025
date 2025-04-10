#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define BUTTON_PIN 21
#define SENSOR_ID "P1"    // ID do sensor
#define LOT_ID "1"        // ID do estacionamento

// Configurações WiFi
const char* ssid = "teste";
const char* password = "12345678";
const char* server_url = "http://192.168.100.165:8080/api/sensors";  // Altere para o endereço IP do seu servidor

int lastState = HIGH;
int currentState;
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 2000;  // Intervalo mínimo entre envios (2 segundos)

void setup() {
  Serial.begin(9600);
  delay(1000);

  WiFi.begin(ssid, password);
  Serial.printf("Conectando a: %s\n", ssid);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.print("\nConectado com IP: ");
  Serial.println(WiFi.localIP());

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Envia o estado inicial
  sendSensorData(true);  // Assumindo vaga disponível inicialmente
}

void sendSensorData(bool isAvailable) {
  // Verifica se o tempo mínimo entre envios foi respeitado
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime < sendInterval) {
    return;
  }
  
  lastSendTime = currentTime;
  
  // Verifica a conexão WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi não conectado. Tentando reconectar...");
    WiFi.reconnect();
    delay(5000);
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Falha na reconexão WiFi");
      return;
    }
  }
  
  HTTPClient http;
  
  // Inicia a conexão HTTP
  http.begin(server_url);
  http.addHeader("Content-Type", "application/json");
  
  // Cria o documento JSON
  StaticJsonDocument<200> doc;
  doc["idSensor"] = SENSOR_ID;
  doc["lot"] = LOT_ID;
  doc["available"] = isAvailable;

  
  // Obtém o timestamp atual (idealmente seria de um servidor NTP)
  // Como o ESP32 não tem RTC, estamos deixando o servidor gerar o timestamp
  
  // Serializa o JSON para string
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Enviando dados: " + jsonString);
  
  // Envia a requisição POST
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Código de resposta HTTP: " + String(httpResponseCode));
    Serial.println("Resposta: " + response);
  } else {
    Serial.print("Erro na requisição HTTP: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void loop() {
  // Leitura do estado do botão
  currentState = digitalRead(BUTTON_PIN);
  
  // O botão pressionado (LOW) significa vaga ocupada (available = false)
  // O botão liberado (HIGH) significa vaga disponível (available = true)
  
  if (lastState == HIGH && currentState == LOW) {
    Serial.println("Botão pressionado - Vaga ocupada");
    sendSensorData(false);  // Vaga ocupada
  } else if (lastState == LOW && currentState == HIGH) {
    Serial.println("Botão liberado - Vaga disponível");
    sendSensorData(true);   // Vaga disponível
  }
  
  lastState = currentState;
  
  delay(50);  // Pequeno delay para estabilidade
}
