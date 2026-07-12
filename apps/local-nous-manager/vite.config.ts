import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built index.html works when loaded via file:// in Electron.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5199, strictPort: true },
});
