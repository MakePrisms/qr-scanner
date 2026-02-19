import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/qr-scanner/',
  plugins: [react(), basicSsl()],
  server: {
    https: true,
    host: true,
    fs: {
      allow: ['..'],
    },
  },
});
