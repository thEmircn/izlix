import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Test API: gecikmeli /api/items, ?fail=1 ile 500
export default defineConfig({
  plugins: [react(), {
    name: 'test-api',
    configureServer(server) {
      server.middlewares.use('/api/items', (req, res) => {
        setTimeout(() => {
          if ((req.url ?? '').includes('fail=1')) { res.statusCode = 500; res.end('{"error":"boom"}'); return }
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: i, name: `Item ${i}` }))))
        }, 120)
      })
    }
  }]
})
