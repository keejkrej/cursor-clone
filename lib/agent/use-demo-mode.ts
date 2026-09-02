'use client'

import { useEffect, useState } from 'react'

export function useDemoMode(): boolean | null {
  const [demo, setDemo] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/agent/status')
      .then((response) => response.json() as Promise<{ demo?: boolean }>)
      .then((body) => {
        if (!cancelled) setDemo(Boolean(body.demo))
      })
      .catch(() => {
        if (!cancelled) setDemo(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return demo
}
