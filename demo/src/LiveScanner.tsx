import { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from '@agicash/qr-scanner';
import type { ScanResult, Camera } from '@agicash/qr-scanner';

interface Props {
  onResult: (result: ScanResult) => void;
}

interface CameraDebugInfo {
  label: string;
  settings: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  videoWidth: number;
  videoHeight: number;
}

export default function LiveScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [flashAvailable, setFlashAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [debugInfo, setDebugInfo] = useState<CameraDebugInfo | null>(null);
  const [debugHistory, setDebugHistory] = useState<Array<{ timestamp: string; info: CameraDebugInfo }>>([]);

  useEffect(() => {
    QrScanner.listCameras(true).then(setCameras).catch(() => {});
  }, []);

  const captureDebugInfo = useCallback(async (label?: string) => {
    const video = videoRef.current;
    if (!video) return;

    const stream = video.srcObject as MediaStream | null;
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    // Find camera label from enumerated devices
    let cameraLabel = label || 'Unknown';
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const settings = track.getSettings();
      const device = devices.find(d => d.deviceId === settings.deviceId);
      if (device) cameraLabel = device.label || `Device ${settings.deviceId?.slice(0, 8)}`;
    } catch {}

    const settings = track.getSettings();
    const capabilities = track.getCapabilities();

    const info: CameraDebugInfo = {
      label: cameraLabel,
      settings: settings as unknown as Record<string, unknown>,
      capabilities: capabilities as unknown as Record<string, unknown>,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    };

    setDebugInfo(info);
    setDebugHistory(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), info },
    ]);
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;
    setError(null);
    setDebugHistory([]);

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          onResult(result);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 15,
          preferredCamera: 'environment',
        },
      );

      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);

      const flash = await scanner.hasFlash();
      setFlashAvailable(flash);

      // Capture initial camera state after a brief delay for video dimensions
      setTimeout(() => captureDebugInfo('Initial start'), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanner');
    }
  };

  const stopScanning = () => {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
    setFlashAvailable(false);
    setFlashOn(false);
    setDebugInfo(null);
  };

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    await scannerRef.current.toggleFlash();
    setFlashOn(scannerRef.current.isFlashOn());
  };

  const switchCamera = async (deviceId: string) => {
    if (!scannerRef.current) return;
    await scannerRef.current.setCamera(deviceId);
    // Capture state after switch
    setTimeout(() => {
      const cam = cameras.find(c => c.id === deviceId);
      captureDebugInfo(`Switch to ${cam?.label || deviceId.slice(0, 8)}`);
    }, 500);
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
    };
  }, []);

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          style={{ width: '100%', display: 'block' }}
          muted
          playsInline
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!scanning ? (
          <button onClick={startScanning} style={btnStyle}>
            Start Scanning
          </button>
        ) : (
          <button onClick={stopScanning} style={{ ...btnStyle, background: '#dc3545' }}>
            Stop
          </button>
        )}

        {flashAvailable && (
          <button onClick={toggleFlash} style={btnStyle}>
            {flashOn ? 'Flash Off' : 'Flash On'}
          </button>
        )}

        {cameras.length > 1 && scanning && (
          <select
            onChange={(e) => switchCamera(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginTop: 8, padding: 8, background: '#fff5f5', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {scanning && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>
            Camera Debug Info
          </summary>
          {debugInfo && (
            <div style={{ marginTop: 8, padding: 8, background: '#f0f0f0', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto' }}>
              <div><strong>Camera:</strong> {debugInfo.label}</div>
              <div><strong>Video element:</strong> {debugInfo.videoWidth}x{debugInfo.videoHeight}</div>
              <div style={{ marginTop: 4 }}><strong>Settings:</strong></div>
              <pre style={{ margin: '2px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(debugInfo.settings, null, 2)}
              </pre>
              <div style={{ marginTop: 4 }}><strong>Capabilities:</strong></div>
              <pre style={{ margin: '2px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(debugInfo.capabilities, null, 2)}
              </pre>
            </div>
          )}

          {debugHistory.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>History (compare before/after switch):</strong>
              {debugHistory.map((entry, i) => (
                <details key={i} style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                    [{entry.timestamp}] {entry.info.label} - {entry.info.settings.width as number}x{entry.info.settings.height as number} zoom={String(entry.info.settings.zoom ?? 'N/A')} focus={String(entry.info.settings.focusMode ?? 'N/A')}
                  </summary>
                  <pre style={{ fontSize: 10, fontFamily: 'monospace', background: '#f8f8f8', padding: 4, margin: '2px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(entry.info.settings, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              const data = {
                current: debugInfo,
                history: debugHistory,
              };
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            }}
            style={{ ...btnStyle, marginTop: 8, fontSize: 12, padding: '6px 12px', background: '#555' }}
          >
            Copy Debug Data
          </button>
        </details>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#0070f3',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
};
