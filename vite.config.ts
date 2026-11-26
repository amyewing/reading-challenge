import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately (npm run dev:api); send /api calls to it.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
