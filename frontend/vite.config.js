import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset links, so the built app works in a sub-folder such as
  // https://zatechnologz.com/academy/ as well as at a site's root.
  base: './',
});
