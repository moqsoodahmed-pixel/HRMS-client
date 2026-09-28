import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deploy-time path prefix. See the Cloudflare Worker + Pages "true path"
// setup this was built for: the frontend is reverse-proxied through
// dutylaunch.com/hrms/* instead of living at a domain's own root (the
// Worker strips the /hrms prefix on every request — HTML, JS, images,
// alike — before forwarding to THIS project's normal .pages.dev hostname,
// so this project's own build/output layout never has to change; only the
// URLs baked into the built HTML/JS need to know they'll be requested with
// that prefix, which is exactly what `base` controls). Defaults to '/' for
// local dev and for any deployment that IS the domain root — only the
// Cloudflare Pages project's build needs an environment variable
// VITE_BASE_PATH=/hrms/ set (Pages project settings → Environment
// variables), so nothing here needs to change again if the mount path
// ever moves.
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});