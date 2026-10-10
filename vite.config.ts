import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env so we can read VITE_API_BASE_URL in config context
  const env = loadEnv(mode, process.cwd(), '')

  // In production the frontend calls the deployed API directly via VITE_API_BASE_URL.
  // In development, when VITE_API_BASE_URL is empty, the proxy below forwards
  // /api/* → localhost:3001 so there are no CORS issues on the dev server.
  const apiBaseUrl = env.VITE_API_BASE_URL || ''

  return {
    plugins: [react()],

    // Expose VITE_API_BASE_URL to the browser bundle (Vite only exposes VITE_* vars)
    // Nothing else from .env reaches the browser.

    server: {
      proxy: apiBaseUrl
        ? {}  // production URL set → no proxy needed in dev either
        : {
            '/api': {
              target: 'http://localhost:3001',
              changeOrigin: true,
            },
          },
    },
  }
})
