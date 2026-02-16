import { QRCodeSVG } from 'qrcode.react';

const testCodes = [
  {
    label: 'Simple (v1, 21x21)',
    content: 'hello',
    size: 200,
  },
  {
    label: 'Medium (v10, ~57x57)',
    content: 'A'.repeat(150),
    size: 250,
  },
  {
    label: 'Dense (v25, ~117x117)',
    content: 'A'.repeat(1000),
    size: 350,
  },
  {
    label: 'Max density (v40, 177x177)',
    content: 'A'.repeat(2500),
    size: 450,
  },
];

export default function TestQRCodes() {
  return (
    <div>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Display these QR codes on screen and scan them with another device to test decoding at various densities.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        {testCodes.map((code) => (
          <div
            key={code.label}
            style={{
              border: '1px solid #eee',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>{code.label}</h3>
            <QRCodeSVG
              value={code.content}
              size={code.size}
              level="L"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              {code.content.length} characters
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
