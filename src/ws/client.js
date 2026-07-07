class WsClient {
  constructor() {
    this.ws = null
    this.handlers = new Map()
    this.reconnectTimer = null
    this.url = ''
    this.isManualClose = false
  }

  connect(url) {
    this.url = url
    this.isManualClose = false
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data)
          const handler = this.handlers.get(type)
          if (handler) handler(payload)
        } catch (e) {
          console.error('Message parse error:', e)
        }
      }

      this.ws.onclose = () => {
        if (this.isManualClose) {
          console.log('WebSocket closed manually')
          return
        }
        console.log('WebSocket disconnected, reconnecting in 3s...')
        this.reconnectTimer = setTimeout(() => this.connect(url), 3000)
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      }
    })
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    }
  }

  on(type, callback) {
    this.handlers.set(type, callback)
  }

  off(type) {
    this.handlers.delete(type)
  }

  close() {
    this.isManualClose = true
    clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const wsClient = new WsClient()
