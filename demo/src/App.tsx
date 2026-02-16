import { useState } from 'react';
import LiveScanner from './LiveScanner';
import ImageScanner from './ImageScanner';
import TestQRCodes from './TestQRCodes';
import ResultDisplay from './ResultDisplay';
import type { ScanResult } from 'wasm-qr-scanner';

type Tab = 'live' | 'image' | 'generate';

const tabLabels: Record<Tab, string> = {
  live: 'Live Scanner',
  image: 'Image Upload',
  generate: 'Test QR Codes',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>wasm-qr-scanner Demo</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        High-performance QR code scanner powered by ZXing-C++ WebAssembly
      </p>

      <nav style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #eee' }}>
        {(Object.keys(tabLabels) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === tab ? '#0070f3' : 'transparent',
              color: activeTab === tab ? 'white' : '#333',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </nav>

      <div>
        {activeTab === 'live' && <LiveScanner onResult={setLastResult} />}
        {activeTab === 'image' && <ImageScanner onResult={setLastResult} />}
        {activeTab === 'generate' && <TestQRCodes />}
      </div>

      {lastResult && (
        <div style={{ marginTop: 16 }}>
          <ResultDisplay result={lastResult} />
          <button
            onClick={() => setLastResult(null)}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Clear Result
          </button>
        </div>
      )}
    </div>
  );
}
