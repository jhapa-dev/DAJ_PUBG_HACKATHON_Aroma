import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fetch from 'node-fetch';
import { WebSocketServer } from 'ws';
import { parseNmeaSentence } from 'nmea-simple';

// ====== CONFIG ======
const SERIAL_PORT = 'COM11'; // Change to your COM port
const BAUD_RATE = 115200;    // Change to match GPS
const WSS_PORT = 4000;
const RECEIVER = { lat: 26.636844, lng: 87.985256 };
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const MIN_MOVE_METERS = 10;
const MIN_ROUTE_INTERVAL_MS = 3000;
// ====================

let lastSender = null;
let lastRouteAt = 0;

// Simple haversine distance (meters)
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
  console.log(`WS listening ws://localhost:${WSS_PORT}`)
);

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Serial setup
const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.on('open', () =>
  console.log(`Serial open on ${SERIAL_PORT} @ ${BAUD_RATE}`)
);

port.on('error', (err) => console.error('Serial error:', err.message));

// Updated parse function
function parseLine(line) {
  const raw = line.trim();

  // Case 1: Extract first two decimal numbers from any text
  const nums = raw.match(/-?\d+\.\d+/g);
  if (nums && nums.length >= 2) {
    const lat = parseFloat(nums[0]);
    const lng = parseFloat(nums[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // Case 2: NMEA sentence
  if (raw.startsWith('$')) {
    try {
      const sentence = parseNmeaSentence(raw);
      if (sentence?.type === 'GGA' || sentence?.type === 'RMC') {
        const lat = sentence.latitude;
        const lng = sentence.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch {
      // ignore parse errors
    }
  }

  return null;
}

parser.on('data', async (line) => {
  const raw = line.toString();
  try {
    const sender = parseLine(raw);
    if (sender) {
      let route = null;
      try {
        route = await getRoute(sender);
      } catch (e) {
        console.error(e.message);
      }

      lastSender = sender;

      broadcast({
        type: 'update',
        sender,
        receiver: RECEIVER,
        route,
        raw
      });
    } else {
      broadcast({
        type: 'raw',
        raw
      });
    }
  } catch (e) {
    console.error('Handler error:', e.message);
  }
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'hello',
    receiver: RECEIVER,
    sender: lastSender,
    route: null
  }));
});
