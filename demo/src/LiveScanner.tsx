import { useEffect, useRef, useState } from 'react';
import QrScanner from 'wasm-qr-scanner';
import type { ScanResult, Camera } from 'wasm-qr-scanner';

interface Props {
  onResult: (result: ScanResult) => void;
}

export default function LiveScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [flashAvailable, setFlashAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    QrScanner.listCameras(true).then(setCameras).catch(() => {});
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;
    setError(null);

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
  };

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    await scannerRef.current.toggleFlash();
    setFlashOn(scannerRef.current.isFlashOn());
  };

  const switchCamera = async (deviceId: string) => {
    if (!scannerRef.current) return;
    await scannerRef.current.setCamera(deviceId);
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
