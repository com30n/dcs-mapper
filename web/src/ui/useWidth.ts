import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  const [, setFontsReady] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { document.fonts.ready.then(() => setFontsReady(true)) }, [])
  return [ref, width] as const
}
