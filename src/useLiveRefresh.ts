import {useEffect, useRef, useState} from 'react'
import {manualCooldownLeft, noteManualRefresh, subscribeManualCooldown} from './dataCache.ts'

export const liveMinuteMs = 60_000
export const liveSlowMs = 5 * 60_000

export type RefreshMode = 'initial' | 'poll' | 'manual'

type RefreshContext = {
  mode: RefreshMode
  isCurrent: () => boolean
}

type LiveRefreshOptions = {
  scope?: string
  warm?: boolean
}

export function useLiveRefresh(
  reloadKey: unknown,
  load: (ctx: RefreshContext) => Promise<void>,
  intervalMs: number | null,
  options?: LiveRefreshOptions,
) {
  const loadRef = useRef(load)
  const optionsRef = useRef(options)
  const [pending, setPending] = useState(() => !(options?.warm ?? false))
  const scope = options?.scope
  const [cooldownMs, setCooldownMs] = useState(() => (scope ? manualCooldownLeft(scope) : 0))
  const updateNowRef = useRef<() => void>(() => {})
  const busyRef = useRef(false)

  useEffect(() => {
    loadRef.current = load
    optionsRef.current = options
  }, [load, options])

  useEffect(() => {
    if (!scope) return
    return subscribeManualCooldown(() => setCooldownMs(manualCooldownLeft(scope)))
  }, [scope])

  useEffect(() => {
    if (!scope || cooldownMs <= 0) return
    const id = window.setInterval(() => setCooldownMs(manualCooldownLeft(scope)), 1000)
    return () => window.clearInterval(id)
  }, [scope, cooldownMs])

  useEffect(() => {
    let current = true
    let requestId = 0
    let pendingCount = 0
    let timer = 0

    async function go(mode: RefreshMode) {
      const id = ++requestId
      const isCurrent = () => current && id === requestId
      const warmStart = mode === 'initial' && (optionsRef.current?.warm ?? false)
      const track = mode !== 'poll' && !warmStart
      const refreshScope = optionsRef.current?.scope
      if (track) {
        pendingCount += 1
        setPending(true)
      } else if (mode === 'initial') {
        setPending(false)
      }
      try {
        await loadRef.current({ mode, isCurrent })
      } catch {
        // Pages report their own errors. A thrown load must not stop later refreshes.
      } finally {
        if (mode === 'manual' && refreshScope) noteManualRefresh(refreshScope)
        if (current && track) {
          pendingCount -= 1
          if (pendingCount <= 0) setPending(false)
        }
      }
    }

    updateNowRef.current = () => {
      const refreshScope = optionsRef.current?.scope
      if (busyRef.current) return
      if (refreshScope && manualCooldownLeft(refreshScope) > 0) return
      busyRef.current = true
      void go('manual').finally(() => {
        busyRef.current = false
      })
    }

    void go('initial')

    function stop() {
      window.clearInterval(timer)
      timer = 0
    }

    function start() {
      if (intervalMs == null) return
      stop()
      timer = window.setInterval(() => {
        if (!document.hidden) void go('poll')
      }, intervalMs)
    }

    function onVisibility() {
      if (document.hidden || intervalMs == null) return
      void go('poll')
      start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      current = false
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reloadKey, intervalMs])

  return {
    pending,
    cooldownMs,
    updateNow: () => updateNowRef.current(),
  }
}
