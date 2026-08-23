import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // The entry chunk was 2.38MB, 91% of it the embedded card JSON. Splitting
    // lets the browser cache card data separately from app code — a code change
    // no longer invalidates 2.2MB of card data in the user's cache, and vice versa.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/data/cards.json')) return 'card-data'
          if (id.includes('node_modules/html-to-image')) return 'html-to-image'
          if (id.includes('node_modules/d3')) return 'd3'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 2600,
  },
})
