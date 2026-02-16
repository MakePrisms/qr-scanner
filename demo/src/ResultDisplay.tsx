import type { ScanResult } from 'wasm-qr-scanner';

interface Props {
  result: ScanResult;
}

export default function ResultDisplay({ result }: Props) {
  return (
    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Scan Result</h3>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
          Decoded Data
        </label>
        <div
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 4,
            padding: 8,
            fontFamily: 'monospace',
            fontSize: 14,
            wordBreak: 'break-all',
            maxHeight: 120,
            overflow: 'auto',
          }}
        >
          {result.data}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          {result.data.length} characters
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
          Corner Points
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
          {result.cornerPoints.map((point, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {['TL', 'TR', 'BR', 'BL'][i]}: ({Math.round(point.x)}, {Math.round(point.y)})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
