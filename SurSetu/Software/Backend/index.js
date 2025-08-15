import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fetch from 'node-fetch';
import { WebSocketServer } from 'ws';

// ====== CONFIG ======
const SERIAL_PORT = 'COM11';
const BAUD_RATE = 115200;
const WSS_PORT = 4000;
const RECEIVER = { lat: 26.636844, lng: 87.985256 };
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const MIN_MOVE_METERS = 10;
const MIN_ROUTE_INTERVAL_MS = 3000;
// ====================

let lastSender = null;
let lastRouteAt = 0;

function haversine(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

async function getRoute(sender) {
  const now = Date.now();
  const movedEnough = !lastSender || haversine(lastSender, sender) >= MIN_MOVE_METERS;
  const intervalOk = now - lastRouteAt >= MIN_ROUTE_INTERVAL_MS;
  if (!movedEnough && !intervalOk) return null;

  const url = `${OSRM_URL}/${sender.lng},${sender.lat};${RECEIVER.lng},${RECEIVER.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates || [];
  const routeLatLng = coords.map(([lng, lat]) => [lat, lng]);
  lastRouteAt = now;
  return routeLatLng;
}

// WebSocket server
const wss = new WebSocketServer({ port: WSS_PORT }, () =>
  console.log(`✅ WS listening on ws://localhost:${WSS_PORT}`)
);

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Serial port
const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.on('open', () => console.log(`🔌 Serial open on ${SERIAL_PORT} @ ${BAUD_RATE}`));
port.on('error', (err) => console.error('❌ Serial error:', err.message));

parser.on('data', async (line) => {
  let raw = line.toString().trim();
  // Many devices prepend "Received: " — strip any repeats safely
  raw = raw.replace(/^(Received:\s*)+/i, '');
  console.log('📥 Parsed:', raw);

  // Handle GPS location
  if (raw.startsWith('LOC:')) {
    // Format: LOC:lat,lng,alt,time
    const after = raw.slice(4); // drop "LOC:"
    const parts = after.split(',');
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const sender = { lat, lng };

        // 1) Broadcast immediately so markers update without waiting for OSRM
        broadcast({
          type: 'coord',
          sender,
          receiver: RECEIVER,
          route: null,
          raw
        });

        // 2) Fetch route in the background and broadcast an updated coord with route
        getRoute(sender)
          .then((route) => {
            if (route && route.length) {
              broadcast({
                type: 'coord',
                sender,
                receiver: RECEIVER,
                route,
                raw
              });
            }
          })
          .catch((e) => console.error('Route error:', e.message));

        lastSender = sender;
      }
    }
  }
  // Handle Emergency/SOS Message (accept both "SOS:" and "MSG:")
  else if (raw.startsWith('SOS:') || raw.startsWith('MSG:')) {
    const text = raw.replace(/^(SOS:|MSG:)\s*/i, '').trim();
    if (text) {
      broadcast({
        type: 'msg',
        text
      });
    }
  }
});

// Send initial hello when frontend connects
wss.on('connection', (ws) => {
  console.log('🔗 Frontend connected');
  ws.send(JSON.stringify({
    type: 'hello',
    receiver: RECEIVER,
    sender: lastSender,
    route: null
  }));
});
