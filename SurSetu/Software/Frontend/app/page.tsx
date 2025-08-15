'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import '../styles/globals.css';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

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

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });

type LatLng = { lat: number; lng: number };
type Payload =
  | { type: 'hello'; receiver: LatLng; sender: LatLng | null; route: [number, number][] | null }
  | { type: 'coord'; receiver: LatLng; sender: LatLng; route: [number, number][] | null; raw: string }
  | { type: 'msg'; text: string };

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
  const [coordLog, setCoordLog] = useState<string[]>([]);
  const [msgLog, setMsgLog] = useState<string[]>([]);
  const [autoFit, setAutoFit] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const coordEndRef = useRef<HTMLDivElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const MAX_LOGS = 50;

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000');
    wsRef.current = ws;

    ws.onopen = () => setConnectionStatus('connected');
    ws.onclose = () => setConnectionStatus('disconnected');
    ws.onerror = () => setConnectionStatus('disconnected');

    ws.onmessage = (evt) => {
      try {
        const data: Payload = JSON.parse(evt.data);
        if (data.type === 'hello') {
          setReceiver(data.receiver);
          if (data.sender) setSender(data.sender);
        } else if (data.type === 'coord') {
          setReceiver(data.receiver);
          setSender(data.sender);
          if (data.route) setRoute(data.route);
          appendCoord(data.raw);
        } else if (data.type === 'msg') {
          appendMsg(data.text);
        }
      } catch {}
    };

    return () => ws.close();
  }, []);

  const appendCoord = useMemo(() => (line: string) => {
    setCoordLog(prev => [...prev, `${new Date().toLocaleTimeString()} | ${line}`].slice(-MAX_LOGS));
  }, [MAX_LOGS]);

  const appendMsg = useMemo(() => (line: string) => {
    setMsgLog(prev => [...prev, `${new Date().toLocaleTimeString()} | ${line}`].slice(-MAX_LOGS));
  }, [MAX_LOGS]);

  // Smart auto-scroll: only scroll to bottom if user is already near the bottom
  useEffect(() => {
    const container = coordEndRef.current?.parentElement;
    if (container && coordLog.length > 0) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      
      if (isNearBottom) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 10);
      }
    }
  }, [coordLog]);

  useEffect(() => {
    const container = msgEndRef.current?.parentElement;
    if (container && msgLog.length > 0) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      
      if (isNearBottom) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 10);
      }
    }
  }, [msgLog]);

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

  const handleClearCoords = useMemo(() => () => setCoordLog([]), []);
  const handleClearMsgs = useMemo(() => () => setMsgLog([]), []);
  const handleToggleAutoFit = useMemo(() => () => setAutoFit(v => !v), []);

  return (
    <div className="dashboard">
      {/* Main Content */}
      <main className="dashboard-main">
        {/* Map Container */}
        <div className="map-container">
          <div className="map-header">
            <h2 className="map-title">Live Tracking Map</h2>
            <div className="map-controls">
              <button 
                className={`control-btn ${autoFit ? 'active' : ''}`}
                onClick={handleToggleAutoFit}
              >
                {autoFit ? '🔒 Auto-Fit ON' : '🔓 Auto-Fit OFF'}
              </button>
            </div>
          </div>
          <div className="map-wrapper">
            <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution="&copy; Aroma Hackforce"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {receiver && <Marker position={[receiver.lat, receiver.lng]} icon={greenIcon} />}
              {sender && <Marker position={[sender.lat, sender.lng]} icon={redIcon} />}
              {route && route.length > 0 && <Polyline positions={route} weight={5} opacity={0.8} />}
              {bounds && <FitBounds bounds={bounds} />}
            </MapContainer>
          </div>
          <div className="map-legend">
            <div className="legend-item">
              <div className="legend-dot receiver"></div>
              <span>Receiver Location</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot sender"></div>
              <span>GPS Sender Location</span>
            </div>
            <div className="legend-item">
              <div className="legend-line"></div>
              <span>Route Path</span>
            </div>
          </div>
        </div>

        {/* Monitoring Panel */}
        <div className="monitoring-panel">
          {/* GPS Coordinates Monitor */}
          <div className="monitor-card">
            <div className="card-header">
              <h3 className="card-title">📍 GPS Coordinates</h3>
              <button 
                className="clear-btn"
                onClick={handleClearCoords}
                title="Clear coordinates log"
              >
                🗑️ Clear
              </button>
            </div>
            <div className="monitor-content">
              <div className="monitor-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Updates:</span>
                  <span className="stat-value">{coordLog.length}</span>
                </div>
                {sender && (
                  <>
                    <div className="stat-item">
                      <span className="stat-label">Current Lat:</span>
                      <span className="stat-value">{sender.lat.toFixed(6)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Current Lng:</span>
                      <span className="stat-value">{sender.lng.toFixed(6)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="monitor-log">
                {coordLog.length > 0 ? (
                  coordLog.map((line, idx) => (
                    <div key={idx} className="log-entry gps-entry">
                      <span className="log-timestamp">{line.split(' | ')[0]}</span>
                      <span className="log-content">{line.split(' | ')[1]}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📡</div>
                    <p>Waiting for GPS data...</p>
                  </div>
                )}
                <div ref={coordEndRef} />
              </div>
            </div>
          </div>

          {/* Message Monitor */}
          <div className="monitor-card">
            <div className="card-header">
              <h3 className="card-title">💬 Emergency Messages</h3>
              <button 
                className="clear-btn"
                onClick={handleClearMsgs}
                title="Clear messages log"
              >
                🗑️ Clear
              </button>
            </div>
            <div className="monitor-content">
              <div className="monitor-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Messages:</span>
                  <span className="stat-value">{msgLog.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Status:</span>
                  <span className={`stat-value ${msgLog.length > 0 ? 'alert' : ''}`}>
                    {msgLog.length > 0 ? '🚨 Active' : '✅ Standby'}
                  </span>
                </div>
              </div>
              <div className="monitor-log">
                {msgLog.length > 0 ? (
                  msgLog.map((line, idx) => (
                    <div key={idx} className="log-entry msg-entry">
                      <span className="log-timestamp">{line.split(' | ')[0]}</span>
                      <span className="log-content emergency">{line.split(' | ')[1]}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📱</div>
                    <p>Waiting for messages...</p>
                  </div>
                )}
                <div ref={msgEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .dashboard-main {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          min-height: calc(100vh - 120px);
        }

        .map-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .map-header {
          padding: 1.5rem 2rem 1rem 2rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .map-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }

        .map-controls {
          display: flex;
          gap: 0.5rem;
        }

        .control-btn {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .control-btn:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .control-btn.active {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        .map-wrapper {
          flex: 1;
          position: relative;
          border-radius: 0 0 16px 16px;
          overflow: hidden;
        }

        .map-legend {
          padding: 1rem 2rem;
          background: rgba(249, 250, 251, 0.8);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          gap: 2rem;
          font-size: 0.875rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6b7280;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .legend-dot.receiver {
          background: #22c55e;
        }

        .legend-dot.sender {
          background: #ef4444;
        }

        .legend-line {
          width: 20px;
          height: 3px;
          background: #3b82f6;
          border-radius: 2px;
        }

        .monitoring-panel {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .monitor-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
        }

        .card-header {
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }

        .clear-btn {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
          background: white;
          color: #6b7280;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-btn:hover {
          border-color: #f87171;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }

        .monitor-content {
          padding: 0 1.5rem 1.5rem 1.5rem;
        }

        .monitor-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background: rgba(249, 250, 251, 0.5);
          border-radius: 8px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
          font-weight: 500;
        }

        .stat-value {
          font-size: 0.875rem;
          color: #1f2937;
          font-weight: 600;
        }

        .stat-value.alert {
          color: #ef4444;
        }

        .monitor-log {
          height: 200px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fafafa;
          scroll-behavior: auto;
        }

        .log-entry {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          gap: 1rem;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.8rem;
        }

        .log-entry:last-child {
          border-bottom: none;
        }

        .log-entry:hover {
          background: rgba(249, 250, 251, 0.8);
        }

        .log-timestamp {
          color: #6b7280;
          font-weight: 500;
          white-space: nowrap;
        }

        .log-content {
          color: #1f2937;
          flex: 1;
        }

        .gps-entry .log-content {
          color: #059669;
        }

        .msg-entry .log-content.emergency {
          color: #dc2626;
          font-weight: 600;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #9ca3af;
          gap: 0.5rem;
        }

        .empty-icon {
          font-size: 2rem;
          opacity: 0.6;
        }

        .empty-state p {
          font-size: 0.875rem;
          margin: 0;
        }

        @media (max-width: 1024px) {
          .dashboard-main {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            padding: 1rem;
          }
        }

        @media (max-width: 640px) {
          .map-legend {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .monitor-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}