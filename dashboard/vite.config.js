import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../tracker/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/status': 'http://localhost:3001',
      '/appointment-history': 'http://localhost:3001',
      '/subscribe': 'http://localhost:3001',
      '/confirm-subscription': 'http://localhost:3001',
      '/subscribers': 'http://localhost:3001',
    },
  },
});
