import { useState, useEffect } from 'react'

// ============================================================
// useIsMobile — shared viewport check (matches App.jsx's 768px
// breakpoint). Pages use it to swap wide grid rows for stacked
// mobile cards.
// ============================================================

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}
