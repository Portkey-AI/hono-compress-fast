/*
 * hono-compress-fast.ts
 * -------------------------------------------------------------------
 * Ultra‑light compression middleware for Hono.
 * • Node.js ⇒ native Brotli (zlib) → fastest throughput
 * • Other runtimes ⇒ Web CompressionStream (gzip / deflate)
 * • Automatically skips Server‑Sent Events (text/event-stream) unless
 *   explicitly overridden.
 * Usage (Node 18+):
 *
 *   import { Hono } from 'hono'
 *   import { compressFast } from 'hono-compress-fast'
 *
 *   const app = new Hono()
 *   app.use(compressFast())
 *
 *   export default app
 */

import type { MiddlewareHandler } from 'hono'

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export interface CompressFastOptions {
  /** Minimum body size (bytes) before compression kicks in. Default: 1024 */
  threshold?: number
  /** Ordered list of encodings to negotiate. First match wins. */
  encodings?: Array<'br' | 'gzip' | 'deflate'>
  /** Brotli quality (0‑11). Node only. Default: 4 */
  brotliQuality?: number
  /** Compress Server‑Sent Event streams? Default: **false** */
  compressEventStream?: boolean
}

/**
 * Drop‑in replacement for `hono/compress` optimised for Node servers.
 * Falls back to gzip/deflate when running outside Node or when the client
 * doesn’t accept Brotli.
 */
export function compressFast (opts: CompressFastOptions = {}): MiddlewareHandler {
  const {
    threshold = 1024,
    encodings = ['br', 'gzip', 'deflate'],
    brotliQuality = 4,
    compressEventStream = false
  } = opts

  // Helper: pick the first mutually‑supported encoding
  const negotiate = (accept: string): 'br' | 'gzip' | 'deflate' | null => {
    for (const enc of encodings) if (accept.includes(enc)) return enc
    return null
  }

  const isNode = typeof process !== 'undefined' && !!process.versions?.node

  // Late‑bound Node zlib import (avoids bundling in browsers)
  let zlib: typeof import('node:zlib') | undefined
  if (isNode) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    zlib = require('node:zlib')
  }

  // -------------------------------------------------------------------
  return async (c, next) => {
    await next()

    const res = c.res
    if (!res.body || res.headers.has('Content-Encoding')) return

    // ---- Skip Server‑Sent Events (they need immediate flush) ---------
    const ctype = (res.headers.get('Content-Type') || '').toLowerCase()
    if (!compressEventStream && ctype.startsWith('text/event-stream')) return

    const encoder = negotiate(c.req.header('Accept-Encoding') || '')
    if (!encoder) return

    const len = Number(res.headers.get('Content-Length') || 0)
    if (len && len < threshold) return

    // ---------------- Node path: native Brotli -----------------------
    if (encoder === 'br' && isNode && zlib) {
      const brotli = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: brotliQuality
        }
      })

      const compressed = (res.body as any).pipe
        ? (res.body as any).pipe(brotli)
        : brotli

      res.headers.set('Content-Encoding', 'br')
      res.headers.delete('Content-Length')
      c.res = new Response(compressed as any, res)
      return
    }

    // ------------- Portable path: gzip / deflate ---------------------
    if ((encoder === 'gzip' || encoder === 'deflate') && typeof CompressionStream === 'function') {
      // Type‑narrowing removes TS error (CompressionFormat = 'gzip' | 'deflate' | 'deflate-raw')
      const stream = new CompressionStream(encoder)
      const compressed = (res.body as ReadableStream<Uint8Array>).pipeThrough(stream)

      res.headers.set('Content-Encoding', encoder)
      res.headers.delete('Content-Length')
      c.res = new Response(compressed, res)
    }
  }
}

export default compressFast
