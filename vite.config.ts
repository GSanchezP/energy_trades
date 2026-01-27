import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), nodePolyfills()],
  // Base path for GitHub Pages deployment
  // For project pages: use '/repository-name/'
  // For user/organization pages: use '/'
  base: process.env.GITHUB_PAGES === 'true' ? '/energy_trades/' : '/',
  build: {
    target: 'es2022', // Support top-level await
  },
})
