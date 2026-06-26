import { config } from 'dotenv'
config({ path: '.env.local' })

// Node 20 lacks native WebSocket; polyfill so @supabase/realtime-js initialises cleanly
import ws from 'ws'
;(globalThis as unknown as Record<string, unknown>).WebSocket = ws
