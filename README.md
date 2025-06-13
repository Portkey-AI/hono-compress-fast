# hono-compress-fast

> Ultra-light Brotli / gzip / deflate compression middleware for Hono.

```ts
import { Hono } from 'hono'
import { compressFast } from 'hono-compress-fast'

const app = new Hono()
app.use(compressFast({ threshold: 1024 }))
````

* **Fast** – streams via Node zlib Brotli when available.
* **Portable** – falls back to Web CompressionStream (gzip/deflate) in Deno, Bun, Workers.
* **Zero deps** – no WASM, no native bindings.

## Install

```bash
npm add hono-compress-fast   # or pnpm / yarn / bun
```

## API

...