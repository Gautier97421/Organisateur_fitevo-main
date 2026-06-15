/**
 * Serveur de synchronisation Yjs (collaboration temps réel) pour l'éditeur de
 * documents. Implémente le protocole y-websocket (sync + awareness) directement
 * via y-protocols/lib0, car y-websocket v3 ne fournit plus de serveur intégré.
 *
 * Module ESM chargé dynamiquement depuis server.js (CommonJS).
 *
 * Persistance : l'état Yjs de chaque document est lu/écrit sur disque via les
 * callbacks `loadDoc(docName)` et `saveDoc(docName, update)` fournis par l'appelant.
 */

import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const messageSync = 0
const messageAwareness = 1

const wsReadyStateOpen = 1
const wsReadyStateClosing = 2

const SAVE_DEBOUNCE_MS = 2000

// docName -> WSSharedDoc
const docs = new Map()

class WSSharedDoc extends Y.Doc {
  constructor(name, saveDoc) {
    super({ gc: true })
    this.name = name
    this.saveDoc = saveDoc
    this.conns = new Map() // ws -> Set(controlledClientIds)
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    this._saveTimer = null

    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const controlled = this.conns.get(conn)
        if (controlled !== undefined) {
          added.forEach((c) => controlled.add(c))
          removed.forEach((c) => controlled.delete(c))
        }
      }
      // Diffuser la mise à jour d'awareness à tous les clients.
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      )
      const buff = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => send(this, c, buff))
    }
    this.awareness.on('update', awarenessChangeHandler)

    this.on('update', (update, origin, doc) => {
      // Diffuser la mise à jour du document.
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeUpdate(encoder, update)
      const message = encoding.toUint8Array(encoder)
      doc.conns.forEach((_, c) => send(doc, c, message))
      // Programmer une sauvegarde sur disque (anti-rebond).
      this.scheduleSave()
    })
  }

  scheduleSave() {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      this.persist()
    }, SAVE_DEBOUNCE_MS)
  }

  async persist() {
    try {
      const update = Y.encodeStateAsUpdate(this)
      await this.saveDoc(this.name, update)
    } catch {
      // sauvegarde best-effort
    }
  }
}

function send(doc, conn, message) {
  if (conn.readyState !== undefined && conn.readyState !== wsReadyStateOpen && conn.readyState !== 0) {
    closeConn(doc, conn)
    return
  }
  try {
    conn.send(message, (err) => {
      if (err != null) closeConn(doc, conn)
    })
  } catch {
    closeConn(doc, conn)
  }
}

function closeConn(doc, conn) {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    // Plus aucun client : on persiste puis on libère le document.
    if (doc.conns.size === 0) {
      doc.persist().finally(() => {
        if (doc.conns.size === 0) {
          docs.delete(doc.name)
          doc.destroy()
        }
      })
    }
  }
  try {
    conn.close()
  } catch {
    // ignore
  }
}

function messageListener(conn, doc, message) {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder))
        }
        break
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        )
        break
    }
  } catch (e) {
    doc.emit('error', [e])
  }
}

async function getYDoc(docName, saveDoc, loadDoc) {
  let doc = docs.get(docName)
  if (doc) return doc
  doc = new WSSharedDoc(docName, saveDoc)
  docs.set(docName, doc)
  // Charger l'état persisté (le cas échéant).
  try {
    const persisted = await loadDoc(docName)
    if (persisted && persisted.length > 0) {
      Y.applyUpdate(doc, persisted, 'persistence')
    }
  } catch {
    // pas d'état persisté
  }
  return doc
}

/**
 * Branche une connexion WebSocket entrante sur le document `docName`.
 * `ctx` : { loadDoc(name)->Promise<Uint8Array|null>, saveDoc(name, update)->Promise }
 */
export async function setupCollabConnection(conn, docName, ctx) {
  conn.binaryType = 'arraybuffer'

  // Le chargement du document est asynchrone (persistance disque) : on tamponne
  // les messages reçus entre-temps pour ne rien perdre.
  let doc = null
  const pending = []
  conn.on('message', (message) => {
    const m = new Uint8Array(message)
    if (doc) messageListener(conn, doc, m)
    else pending.push(m)
  })

  doc = await getYDoc(docName, ctx.saveDoc, ctx.loadDoc)
  doc.conns.set(conn, new Set())
  for (const m of pending) messageListener(conn, doc, m)
  pending.length = 0

  // Keepalive
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) closeConn(doc, conn)
      clearInterval(pingInterval)
      return
    }
    if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, 30000)
  conn.on('pong', () => { pongReceived = true })

  conn.on('close', () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  })

  // Étape 1 de synchronisation : envoyer l'état du serveur.
  {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
  }

  // Envoyer les états d'awareness existants.
  const awarenessStates = doc.awareness.getStates()
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())),
    )
    send(doc, conn, encoding.toUint8Array(encoder))
  }
}
