'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { UserProfile, EMPTY_PROFILE } from './profile'

interface ProfileContextValue {
  profile: UserProfile | null
  setProfile: (p: UserProfile) => void
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null)

  function setProfile(p: UserProfile) {
    setProfileState(p)
  }

  function clearProfile() {
    setProfileState(null)
  }

  return (
    <ProfileContext.Provider value={{ profile, setProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
