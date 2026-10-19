import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server forwards every /api request to the backend at API_URL
// (set in frontend/.env).
export default defineConfig(({ mode }) => {
  const { API_URL } = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
      },
    },
  };
});
