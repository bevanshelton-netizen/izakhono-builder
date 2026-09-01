import http from 'node:http'

const originalCreateServer = http.createServer.bind(http)
const allowedOrigins = new Set((process.env.IZAKHONO_CORE_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean))

function corsHeaderFor(req) {
  const origin = req.headers.origin
  return origin && (allowedOrigins.has(origin) || allowedOrigins.has('*')) ? origin : null
}

http.createServer = function createSafeServer(...args) {
  const listenerIndex = args.findIndex(value => typeof value === 'function')
  if (listenerIndex < 0) return originalCreateServer(...args)

  const listener = args[listenerIndex]
  args[listenerIndex] = (req, res) => {
    const originalWriteHead = res.writeHead.bind(res)
    res.writeHead = function safeWriteHead(statusCode, statusMessageOrHeaders, maybeHeaders) {
      let statusMessage = statusMessageOrHeaders
      let headers = maybeHeaders
      if (statusMessageOrHeaders && typeof statusMessageOrHeaders === 'object') {
        headers = statusMessageOrHeaders
        statusMessage = undefined
      }
      headers = { ...(headers || {}) }
      const origin = corsHeaderFor(req)
      if (origin && !Object.keys(headers).some(key => key.toLowerCase() === 'access-control-allow-origin')) {
        headers['access-control-allow-origin'] = origin
        headers.vary = headers.vary ? `${headers.vary}, Origin` : 'Origin'
      }
      if (!Object.keys(headers).some(key => key.toLowerCase() === 'x-content-type-options')) headers['x-content-type-options'] = 'nosniff'
      return statusMessage === undefined
        ? originalWriteHead(statusCode, headers)
        : originalWriteHead(statusCode, statusMessage, headers)
    }

    Promise.resolve(listener(req, res)).catch(error => {
      const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500
      if (status >= 500) console.error('unhandled request error', error)
      if (res.headersSent) {
        res.destroy()
        return
      }
      const message = status >= 500 ? 'Internal server error' : (error?.message || 'Request failed')
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ error: message }))
    })
  }

  return originalCreateServer(...args)
}

await import('./runtime.mjs')
