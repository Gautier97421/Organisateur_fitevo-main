/**
 * Serveur custom Fitevo.
 *
 * Remplace `next start` afin d'attacher un serveur WebSocket (temps réel du
 * module Communication) sur le même serveur HTTP que Next. Les route handlers
 * Next et ce serveur tournent dans le même processus et partagent le registre
 * de connexions exposé par `lib/realtime` via `globalThis`.
 *
 * Lancement : `node server.js` (dev ou prod selon NODE_ENV).
 */

const { createServer } = require('node:http')
const { parse } = require('node:url')
const { createHmac, timingSafeEqual } = require('node:crypto')
const { promises: fsp } = require('node:fs')
const path = require('node:path')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

// Clé du registre partagé — DOIT correspondre à GLOBAL_KEY dans lib/realtime.ts
const GLOBAL_KEY = '__fitevoRealtime'
const DEV_SESSION_SECRET = 'fitevo-dev-session-secret-change-me'

function getRegistry() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = { connections: new Map() }
  }
  return globalThis[GLOBAL_KEY]
}

function getSessionSecret() {
  const configured = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== 'production') return DEV_SESSION_SECRET
  return null
}

function extractSessionCookie(cookieHeader) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === 'fitevo_session') return rest.join('=')
  }
  return null
}

// Vérifie le cookie de session signé HMAC-SHA256 (même logique que lib/session.ts)
function verifySession(cookieValue) {
  try {
    if (!cookieValue) return null
    const parts = cookieValue.split(':')
    if (parts.length !== 2) return null
    const [hexPayload, hmac] = parts
    const secret = getSessionSecret()
    if (!secret) return null

    const expected = createHmac('sha256', secret).update(hexPayload).digest('hex')
    const sigBuf = Buffer.from(hmac, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null

    const payload = JSON.parse(Buffer.from(hexPayload, 'hex').toString('utf-8'))
    if (!payload || typeof payload.id !== 'string') return null
    return { id: payload.id, role: typeof payload.role === 'string' ? payload.role : '' }
  } catch {
    return null
  }
}

// Vérifie le jeton d'accès à un document collaboratif (cf. lib/collab-token.ts).
function verifyCollabToken(token, docId) {
  try {
    if (!token) return null
    const parts = token.split(':')
    if (parts.length !== 2) return null
    const [hexPayload, hmac] = parts
    const secret = getSessionSecret()
    if (!secret) return null

    const expected = createHmac('sha256', secret).update(hexPayload).digest('hex')
    const sigBuf = Buffer.from(hmac, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null

    const payload = JSON.parse(Buffer.from(hexPayload, 'hex').toString('utf-8'))
    if (!payload || payload.docId !== docId) return null
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

// ── Persistance des documents collaboratifs (état Yjs sur disque) ──
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
const COLLAB_DIR = path.join(UPLOAD_DIR, 'collab')
// docId sûr : uniquement caractères de cuid (anti-traversée de chemin).
const SAFE_DOC_ID = /^[a-zA-Z0-9_-]{1,64}$/

async function loadCollabDoc(docName) {
  if (!SAFE_DOC_ID.test(docName)) return null
  try {
    const buf = await fsp.readFile(path.join(COLLAB_DIR, `${docName}.ydoc`))
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

async function saveCollabDoc(docName, update) {
  if (!SAFE_DOC_ID.test(docName)) return
  await fsp.mkdir(COLLAB_DIR, { recursive: true })
  const target = path.join(COLLAB_DIR, `${docName}.ydoc`)
  const tmp = `${target}.tmp`
  await fsp.writeFile(tmp, Buffer.from(update))
  await fsp.rename(tmp, target)
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  // Chargement dynamique du module ESM de synchronisation Yjs (server.js est en CommonJS).
  let setupCollabConnection = null
  let collabWss = null
  try {
    const collab = await import('./collab-server.mjs')
    setupCollabConnection = collab.setupCollabConnection
    collabWss = new WebSocketServer({ noServer: true })
  } catch (err) {
    console.error('Collaboration Yjs indisponible :', err)
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // Serveur WebSocket en mode noServer : on gère manuellement l'upgrade
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const parsed = parse(req.url || '', true)
    const pathname = parsed.pathname

    // ── Collaboration documents (Yjs) ──────────────────────────────
    // Le client y-websocket place le nom de salle dans le chemin : /api/collab/<docId>
    if (pathname && pathname.startsWith('/api/collab/')) {
      if (!setupCollabConnection || !collabWss) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n')
        socket.destroy()
        return
      }
      const docId = decodeURIComponent(pathname.slice('/api/collab/'.length))
      const token = typeof parsed.query.token === 'string' ? parsed.query.token : ''
      // Le jeton doit être valide ET correspondre au document demandé.
      if (!docId || !SAFE_DOC_ID.test(docId) || !verifyCollabToken(token, docId)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      collabWss.handleUpgrade(req, socket, head, (ws) => {
        setupCollabConnection(ws, docId, { loadDoc: loadCollabDoc, saveDoc: saveCollabDoc })
          .catch((err) => {
            console.error('Erreur connexion collaboration :', err)
            try { ws.close() } catch {}
          })
      })
      return
    }

    // ── Messagerie temps réel ──────────────────────────────────────
    if (pathname !== '/api/ws') {
      // Laisser Next gérer les autres upgrades (HMR en dev)
      return
    }

    const session = verifySession(extractSessionCookie(req.headers.cookie))
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, session)
    })
  })

  const registry = getRegistry()

  wss.on('connection', (ws, req, session) => {
    const userId = session.id
    ws.isAlive = true

    let set = registry.connections.get(userId)
    if (!set) {
      set = new Set()
      registry.connections.set(userId, set)
    }
    set.add(ws)

    ws.on('pong', () => { ws.isAlive = true })

    ws.on('message', (raw) => {
      // Le client n'a pas besoin d'émettre (l'envoi passe par l'API REST),
      // mais on tolère un ping applicatif pour garder la connexion vivante.
      try {
        const msg = JSON.parse(raw.toString())
        if (msg && msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
      } catch {
        // message ignoré
      }
    })

    const cleanup = () => {
      const s = registry.connections.get(userId)
      if (s) {
        s.delete(ws)
        if (s.size === 0) registry.connections.delete(userId)
      }
    }
    ws.on('close', cleanup)
    ws.on('error', cleanup)
  })

  // Heartbeat : ferme les sockets mortes toutes les 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false
      try { ws.ping() } catch { /* noop */ }
    })
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))

  server.listen(port, hostname, () => {
    console.log(`> Fitevo prêt sur http://${hostname}:${port} (WS: /api/ws)`)
  })
})
