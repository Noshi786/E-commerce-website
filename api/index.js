import app from '../server.js'

export default function handler(req, res) {
  const requestUrl = new URL(req.url, 'http://localhost')
  const forwardedPath = requestUrl.searchParams.get('__path')

  if (forwardedPath !== null) {
    requestUrl.searchParams.delete('__path')
    const query = requestUrl.searchParams.toString()
    req.url = `/${forwardedPath}${query ? `?${query}` : ''}`
  }

  return app(req, res)
}
