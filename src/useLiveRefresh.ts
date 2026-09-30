import {useEffect, useRef, useState} from 'react'

export const liveMinuteMs = 60_000
export const liveSlowMs = 5 * 60_000

export type RefreshMode = 'initial' | 'poll' | 'manual'

type RefreshContext = {
  mode: RefreshMode
  isCurrent: () => boolean
}

export function useLiveRefresh(
  reloadKey: unknown,
  load: (ctx: RefreshContext) => Promise<void>,
  intervalMs: number | null,
) {
  const loadRef = useRef(load)
  const [pending, setPending] = useState(true)
  const updateNowRef = useRef<() => void>(() => {})

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    let current = true
    let requestId = 0
    let pendingCount = 0
    let timer = 0

    async function go(mode: RefreshMode) {
      const id = ++requestId
      const isCurrent = () => current && id === requestId
      const track = mode !== 'poll'
      if (track) {
        pendingCount += 1
        setPending(true)
      }
      try {
        await loadRef.current({ mode, isCurrent })
      } catch {
        // Pages report their own errors. A thrown load must not stop later refreshes.
      } finally {
        if (current && track) {
          pendingCount -= 1
          if (pendingCount <= 0) setPending(false)
        }
      }
    }

    updateNowRef.current = () => {
      void go('manual')
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
    updateNow: () => updateNowRef.current(),
  }
}
