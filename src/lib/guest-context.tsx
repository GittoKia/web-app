'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface GuestContextValue {
  isGuest: boolean
  setGuest: () => void
  clearGuest: () => void
}

const GuestContext = createContext<GuestContextValue | null>(null)

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false)

  function setGuest() {
    setIsGuest(true)
    // Cookie lets middleware allow access to protected routes
    document.cookie = 'guest=1; path=/; max-age=86400; SameSite=Lax'
  }

  function clearGuest() {
    setIsGuest(false)
    document.cookie = 'guest=; path=/; max-age=0'
  }

  return (
    <GuestContext.Provider value={{ isGuest, setGuest, clearGuest }}>
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest() {
  const ctx = useContext(GuestContext)
  if (!ctx) throw new Error('useGuest must be used within GuestProvider')
  return ctx
}
