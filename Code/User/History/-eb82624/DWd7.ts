import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { networkInterfaces } from 'os'
import QRCode from 'qrcode'

// ─── Network QR plugin ────────────────────────────────────────────────────────
// Prints a QR code in the terminal after the dev server starts so you can
// instantly open the app on your phone (same WiFi network).
function networkQrPlugin() {
  return {
    name: 'network-qr',
    configureServer(server: {
      httpServer: { on: (event: string, cb: () => void) => void } | null
    }) {
      server.httpServer?.on('listening', async () => {
        const port = 5173
        // Find the first non-internal IPv4 address (your WiFi IP)
        const ip = Object.values(networkInterfaces())
          .flat()
          .find(
            (iface) => iface && !iface.internal && iface.family === 'IPv4',
          )?.address

        if (!ip) return

        const url = `http://${ip}:${port}`
        console.log(`\n  📱 Network: \x1b[36m${url}\x1b[0m\n`)

        try {
          const qr = await QRCode.toString(url, {
            type: 'terminal',
            small: true,
          })
          console.log(qr)
        } catch {
          // qrcode not available — skip silently
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), networkQrPlugin()],
  server: {
    host: true, // bind to 0.0.0.0 so phone on same WiFi can connect
    port: 5173,
    headers: {
      // Prevent browser/phone from caching JS/CSS bundles during development.
      // This fixes stale-bundle issues where the phone serves old code after
      // source files are updated (e.g. old RPC calls that no longer exist in DB).
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  },
  resolve: {
    alias: {
      '@shared/constants': resolve(__dirname, 'src/shared/constants'),
      '@shared/ui/layout': resolve(__dirname, 'src/shared/ui/layout'),
      '@shared/ui/form': resolve(__dirname, 'src/shared/ui/form'),
      '@shared/ui/typography': resolve(__dirname, 'src/shared/ui/typography'),
      '@features': resolve(__dirname, 'src/features'),
      '@lib': resolve(__dirname, 'src/lib'),
    },
  },
})

