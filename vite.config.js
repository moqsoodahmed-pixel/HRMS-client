import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deploy-time path prefix. See the Cloudflare Worker + Pages "true path"
// setup this was built for: the frontend is reverse-proxied through
// dutylaunch.com/hrms/* instead of living at a domain's own root (the
// Worker strips the /hrms prefix on every request — HTML, JS, images,
// alike — before forwarding to THIS project's normal .pages.dev hostname,
// so this project's own build/output layout never has to change; only the
// URLs baked into the built HTML/JS need to know they'll be requested with
// that prefix, which is exactly what `base` controls).
//
// This used to rely on a Cloudflare Pages "VITE_BASE_PATH=/hrms/" dashboard
// environment variable at build time. In practice that variable was not
// making it into the production build (Cloudflare kept shipping unprefixed
// /assets/* paths even after it was added and the project was redeployed),
// so the built HTML pointed at /assets/index-*.js at the domain root
// instead of /hrms/assets/index-*.js — those root requests never match the
// Worker's /hrms* route, so they fall straight through to the WordPress
// site at the domain root and 404 there.
//
// Fix: default straight to '/hrms/' for a real production build, since
// that mount path is the permanent home for this app and shouldn't depend
// on a dashboard setting being present/correct. VITE_BASE_PATH can still
// override it if the mount path ever needs to change without touching
// this file. Local dev (`vite` / `npm run dev`) is untouched — it keeps
// serving from '/' so http://localhost:5173 still works normally.
export default defineConfig(({ command }) => {
  const defaultBase = command === 'build' ? '/hrms/' : '/';
  const basePath = process.env.VITE_BASE_PATH || defaultBase;

  return {
    plugins: [react()],
    base: basePath,
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:5000',
      },
    },
  };
});