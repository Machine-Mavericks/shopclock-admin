import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Lets the admin app be hosted under a path prefix (e.g. "/sc/") when it can't
  // have its own subdomain, such as behind an mDNS .local hostname.
  base: process.env.VITE_BASE_PATH || "/",
})
