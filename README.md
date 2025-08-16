# Programmers Unknown Battlegrounds (PUBG) - DAJ

Team: Aroma

# LoRa GPS Tracker with Real-time Map + Routing

This project demonstrates a **LoRa GPS tracking system** with:
- **Backend (Node.js)** reading GPS data from LoRa **receiver module** via Serial Port.
- **WebSocket server** to stream live GPS coordinates to clients.
- **Frontend (Next.js + Leaflet)** displaying real-time sender and receiver positions on an OpenStreetMap tiles, with **OSRM route calculation** between them.
- **Location history** drawn as a polyline trail.

---

## 📌 Features
- Reads GPS coordinates from **COM11 @ 115200 baud** (LoRa receiver).
- Pushes live updates to frontend via **WebSockets**.
- Plots sender & receiver on map with **Leaflet**.
- Requests routes from **OSRM server** (online and local Docker instance).
- Stores location history & draws trail.
- Can run **frontend + backend together** with a single command.

---
## 📡 Data Structures

### LoRa GPS Payload (example from Serial): LAT:27.7172,LON:85.3240

### Parsed JSON Format in Backend:
```json
{
  "lat": 27.7172,
  "lon": 85.3240,
  "timestamp": "2025-08-16T06:30:25Z"
}


Websocket message:
{
  "type": "gps",
  "data": {
    "lat": 27.7172,
    "lon": 85.3240
  }
}


OSRM route requess
http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson


⚙️ Installation
1.	Clone the repo
git clone https://github.com/your-username/jhapa-dev/DAJ PUBG HAKCATHON Aroma.git
cd DAJ PUBG HACKATHON Aroma


Install dependencies

# Backend
cd server
npm install

# Frontend
cd ../next-app
npm install

# Root (for concurrently)
cd ..
npm install concurrently --save-dev 

Setup root package.json
 
 {
  "name": "lora-map-project",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix next-app\" \"npm start --prefix server\""
  }
}


🚀 Running the App

Run frontend + backend together:

npm run dev
OR
npm run start-all


Backend: ws://localhost:4000

Frontend: http://localhost:3000

🌍 Routing

You can use either:

Online OSRM API:
https://router.project-osrm.org/route/v1/driving/...

Offline OSRM (Docker) for Nepal or your region:

docker run -t -i -p 5000:5000 osrm/osrm-backend \
  osrm-routed --algorithm mld /data/nepal-latest.osrm


Then change route URL in frontend to:

http://localhost:5000/route/v1/driving/...


🔧 Troubleshooting

1. Serial not opening? → Make sure your LoRa receiver is on COM11 and baud = 115200.

2. No map? → Check Leaflet CSS is imported via _document.js instead of <Head>.

3. Route not showing? → Try the online OSRM first before setting up local.