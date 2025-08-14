'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import '../styles/globals.css';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

// Fix default marker icons (Next.js bundling)
delete L.Icon.Default.prototype._getIconUrl;

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Dynamic import react-leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });

type LatLng = { lat: number; lng: number };
type Payload =
  | { type: 'hello'; receiver: LatLng; sender: LatLng | null; route: [number, number][] | null }
  | { type: 'update'; receiver: LatLng; sender: LatLng; route: [number, number][] | null; raw: string }
  | { type: 'raw'; raw: string };

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, bounds]);
  return null;
}

export default function Page() {
  const [receiver, setReceiver] = useState<LatLng | null>(null);
  const [sender, setSender] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [rawLog, setRawLog] = useState<string[]>([]);
  const [autoFit, setAutoFit] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const monitorEndRef = useRef<HTMLDivElement>(null);
  const MAX_LOGS = 50; // Keep only the latest 50 logs

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000');
    wsRef.current = ws;

    ws.onopen = () => appendRaw('[WS] Connected');
    ws.onclose = () => appendRaw('[WS] Disconnected');
    ws.onerror = () => appendRaw('[WS] Error');
    ws.onmessage = (evt) => {
      try {
        const data: Payload = JSON.parse(evt.data);
        if (data.type === 'hello') {
          setReceiver(data.receiver);
          if (data.sender) setSender(data.sender);
        } else if (data.type === 'update') {
          setReceiver(data.receiver);
          setSender(data.sender);
          if (data.route) setRoute(data.route);
          if (data.raw) appendRaw(data.raw);
        } else if (data.type === 'raw') {
          appendRaw(data.raw);
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  function appendRaw(line: string) {
    setRawLog(prev => {
      const updated = [...prev, line];
      return updated.slice(-MAX_LOGS); // Keep last N logs
    });
  }

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    monitorEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawLog]);

  // Compute map center and bounds
  const center = useMemo<L.LatLngExpression>(() => {
    if (sender) return [sender.lat, sender.lng];
    if (receiver) return [receiver.lat, receiver.lng];
    return [26.636844, 87.985256];
  }, [sender, receiver]);

  const bounds = useMemo(() => {
    if (!autoFit) return null;
    const points: [number, number][] = [];
    if (receiver) points.push([receiver.lat, receiver.lng]);
    if (sender) points.push([sender.lat, sender.lng]);
    if (route && route.length) points.push(...route);
    if (!points.length) return null;
    return L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
  }, [autoFit, receiver, sender, route]);

  return (
    <div className="app">
      <header className="header">
        <h2 style={{ margin: 0 }}>Map of the constant plotting</h2>
        <div style={{ opacity: 0.7 }}>
          Receiver fixed at <code>26.636844, 87.985256</code>
        </div>
      </header>

      <div className="map">
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; Aroma Hackforce"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {receiver && <Marker position={[receiver.lat, receiver.lng]} icon={greenIcon} />}
          {sender && <Marker position={[sender.lat, sender.lng]} icon={redIcon} />}

          {route && route.length > 0 && (
            <Polyline positions={route} weight={5} opacity={0.8} />
          )}

          {bounds && <FitBounds bounds={bounds} />}
        </MapContainer>
      </div>

      <aside className="panel">
        <div className="kpis">
          <div className="kpi">
            <div style={{ fontSize: 12, opacity: 0.6 }}>Sender</div>
            <div style={{ fontWeight: 600 }}>
              {sender ? `${sender.lat.toFixed(6)}, ${sender.lng.toFixed(6)}` : '—'}
            </div>
          </div>
          <div className="kpi">
            <div style={{ fontSize: 12, opacity: 0.6 }}>Receiver</div>
            <div style={{ fontWeight: 600 }}>
              {receiver ? `${receiver.lat.toFixed(6)}, ${receiver.lng.toFixed(6)}` : '—'}
            </div>
          </div>
        </div>

        <div className="controls">
          <button onClick={() => setAutoFit(v => !v)}>
            {autoFit ? 'Disable Auto-Fit' : 'Enable Auto-Fit'}
          </button>
          <button onClick={() => setRawLog([])}>Clear Monitor</button>
        </div>

        <h3>Serial Monitor</h3>
        <div
          className="monitor"
          style={{
            maxHeight: '250px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            backgroundColor: '#111',
            color: '#0f0',
            padding: '10px',
            borderRadius: '5px'
          }}
        >
          {rawLog.length > 0
            ? rawLog.map((line, idx) => <div key={idx}>{line}</div>)
            : 'Waiting for serial data...'}
          <div ref={monitorEndRef} />
        </div>
      </aside>
    </div>
  );
}
