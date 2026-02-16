import { useCallback, useState, useRef } from 'react';
import QrScanner from 'wasm-qr-scanner';
import type { ScanResult } from 'wasm-qr-scanner';

interface Props {
  onResult: (result: ScanResult) => void;
}

export default function ImageScanner({ onResult }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scanFile = useCallback(
    async (file: File) => {
      setError(null);
      setScanning(true);
      try {
        const result = await QrScanner.scanImage(file);
        onResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to decode QR code');
      } finally {
        setScanning(false);
      }
    },
    [onResult],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) scanFile(file);
    },
    [scanFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) scanFile(file);
    },
    [scanFile],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#0070f3' : '#ddd'}`,
          borderRadius: 8,
          padding: 48,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#f0f7ff' : '#fafafa',
          transition: 'all 0.2s',
        }}
      >
        <p style={{ margin: 0, fontSize: 16, color: '#666' }}>
          {scanning ? 'Scanning...' : 'Drop an image here or click to select'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#999' }}>
          Supports PNG, JPG, WebP, and other image formats
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div style={{ color: '#dc3545', marginTop: 8, padding: 8, background: '#fff5f5', borderRadius: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
