'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGuest } from '@/lib/guest-context'

export default function AuthPage() {
  const router = useRouter()
  const { setGuest } = useGuest()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function handleApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function handleEmailAuth() {
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/chat')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        router.push('/onboarding')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function handleGuest() {
    setGuest()
    router.push('/onboarding')
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div
        className="w-full bg-white rounded-2xl border border-tan p-8 flex flex-col gap-6"
        style={{ maxWidth: 420 }}
      >
        {/* Header */}
        <div className="text-center">
          <h1
            className="text-3xl text-charcoal"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
          >
            Caregiver AI
          </h1>
          <p className="mt-1 text-sm text-steel" style={{ fontFamily: 'var(--font-body)' }}>
            Sign in to save your conversations.
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-3 w-full h-12 bg-white border border-tan rounded-xl text-charcoal text-sm font-medium transition-colors hover:border-sage"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={handleApple}
            className="flex items-center justify-center gap-3 w-full h-12 bg-white border border-tan rounded-xl text-charcoal text-sm font-medium transition-colors hover:border-sage"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-silver" />
          <span className="text-xs text-mist" style={{ fontFamily: 'var(--font-body)' }}>or</span>
          <div className="flex-1 h-px bg-silver" />
        </div>

        {/* Email / Password */}
        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-silver bg-white text-charcoal text-sm placeholder-mist outline-none focus:border-steel transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-silver bg-white text-charcoal text-sm placeholder-mist outline-none focus:border-steel transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          />

          {error && (
            <p className="text-xs text-coral" style={{ fontFamily: 'var(--font-body)' }}>
              {error}
            </p>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="w-full h-12 bg-navy text-cream rounded-xl text-sm font-medium disabled:opacity-60 transition-opacity"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="text-xs text-steel text-center hover:text-charcoal transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {mode === 'signin'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Guest */}
        <button
          onClick={handleGuest}
          className="text-xs text-mist text-center hover:text-steel transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Continue as guest
        </button>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.26.64c.08.6-.17 1.2-.52 1.66-.38.5-.99.88-1.6.83-.09-.6.19-1.21.54-1.64C11.03.97 11.68.6 12.26.64ZM14.7 6.3c-.05.03-2.03 1.02-2.01 3.35.02 2.77 2.46 3.69 2.49 3.7-.03.08-.39 1.28-1.27 2.52-.77 1.08-1.57 2.14-2.79 2.16-1.19.02-1.58-.67-2.95-.67-1.38 0-1.81.65-2.94.69-1.18.04-2.08-1.14-2.86-2.21C.84 13.7-.19 10.63.93 8.1c.55-1.25 1.56-2.04 2.69-2.06 1.17-.02 1.67.67 2.99.67 1.31 0 1.73-.67 3.13-.67 1.01.01 1.97.5 2.96 1.26Z" fill="#000"/>
    </svg>
  )
}
