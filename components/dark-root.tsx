'use client'

import { useLayoutEffect } from 'react'

export function DarkRoot() {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    return () => {
      root.classList.remove('dark')
    }
  }, [])

  return null
}
