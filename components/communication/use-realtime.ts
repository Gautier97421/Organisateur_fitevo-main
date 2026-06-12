"use client"

import { useEffect, useRef } from "react"
import type { RealtimeEvent } from "./types"

/**
 * Connexion WebSocket temps réel vers /api/ws.
 * - Authentification portée par le cookie de session (envoyé automatiquement à l'upgrade).
 * - Reconnexion automatique avec backoff exponentiel plafonné.
 * - Ping applicatif périodique pour garder la connexion vivante.
 *
 * `onEvent` est conservé dans une ref pour ne pas relancer la connexion à chaque rendu.
 */
export function useRealtime(onEvent: (event: RealtimeEvent) => void, enabled = true) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let attempts = 0
    let closedByUser = false

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const url = `${protocol}//${window.location.host}/api/ws`
      try {
        ws = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        attempts = 0
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }))
          }
        }, 25_000)
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as RealtimeEvent
          onEventRef.current(data)
        } catch {
          // payload ignoré
        }
      }

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
        if (!closedByUser) scheduleReconnect()
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    const scheduleReconnect = () => {
      attempts += 1
      const delay = Math.min(1000 * 2 ** attempts, 30_000)
      reconnectTimer = setTimeout(connect, delay)
    }

    connect()

    return () => {
      closedByUser = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pingTimer) clearInterval(pingTimer)
      ws?.close()
    }
  }, [enabled])
}
