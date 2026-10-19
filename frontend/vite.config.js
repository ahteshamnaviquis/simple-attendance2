import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Settings come from frontend/.env (see .env.example), with defaults below.
// FRONTEND_PORT and API_URL are only used here, by the dev server.
// Variables starting with VITE_ are also available in the browser code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: Number(env.FRONTEND_PORT) || 5173,
      // Send every /api request to the Express backend.
      // This avoids CORS setup and keeps the frontend code simple.
      proxy: {
        '/api': env.API_URL || 'http://127.0.0.1:5050',
      },
    },
  };
});
