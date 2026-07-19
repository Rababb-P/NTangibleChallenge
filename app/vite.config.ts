import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Trust Your Gut game imports season JSON straight from the repo's
  // data/ folder (one level above this app), so allow dev-server access to it.
  server: { fs: { allow: [".."] } },
})
