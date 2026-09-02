'use client'

import { useLayoutEffect } from 'react'

export function HtmlTheme({ dark }: { dark: boolean }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    return () => {
      root.classList.remove('dark')
    }
  }, [dark])

  return null
}
