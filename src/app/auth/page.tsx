'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
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

  async function handleGoogle() {
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    } catch {
      setError('Could not connect to authentication service.')
    }
  }

  async function handleApple() {
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    } catch {
      setError('Could not connect to authentication service.')
    }
  }

  async function handleEmailAuth() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
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
    <main className="min-h-screen bg-cream flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[460px] surface-panel rounded-[28px] p-6 sm:p-7 flex flex-col gap-6 fade-rise">
        <div className="text-center">
          <p className="section-eyebrow text-steel">Secure access</p>
          <h1 className="font-display italic text-[28px] leading-[1.2] text-charcoal">
            Caregiver AI
          </h1>
          <p className="mt-2 font-sans text-[14px] leading-6 text-steel">
            Sign in to save your conversations, language, and care profile across visits.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-cream/80 p-2 text-center">
          {['Private', 'Multilingual', 'Free to try'].map((item) => (
            <div key={item} className="rounded-xl bg-white px-3 py-2 font-sans text-[12px] font-medium text-steel">
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogle}
            className="flex items-center justify-center gap-3 w-full h-12 bg-white border border-tan rounded-xl font-sans text-[14px] font-bold text-charcoal transition-colors duration-150 hover:border-sage"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={handleApple}
            className="flex items-center justify-center gap-3 w-full h-12 bg-white border border-tan rounded-xl font-sans text-[14px] font-bold text-charcoal transition-colors duration-150 hover:border-sage"
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        {/* Divider — tan */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-tan" />
          <span className="font-sans text-[12px] text-mist">or</span>
          <div className="flex-1 h-px bg-tan" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Mail size={20} strokeWidth={1.5} className="absolute start-4 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 ps-12 pe-4 rounded-xl border border-tan bg-white font-sans text-[14px] text-charcoal placeholder:text-mist outline-none focus:border-sage transition-colors duration-150"
            />
          </div>
            <input
              type="password"
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-tan bg-white font-sans text-[14px] text-charcoal placeholder:text-mist outline-none focus:border-sage transition-colors duration-150"
            />

            {mode === 'signup' && (
              <p className="px-1 font-sans text-[12px] leading-[1.5] text-steel">
                Use a strong password so your care information stays protected.
              </p>
            )}

          {error && (
            <p className="font-sans text-[12px] leading-[1.4] text-coral">
              {error}
            </p>
          )}

            <button
              type="button"
              onClick={handleEmailAuth}
              disabled={loading || !email || !password}
              className="w-full h-12 bg-navy text-cream rounded-xl font-sans text-[14px] font-bold transition-colors duration-150 hover:bg-navy-hover disabled:bg-silver disabled:text-mist disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => { setMode((m) => m === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="font-sans text-[13px] text-steel text-center transition-colors duration-150 hover:text-charcoal"
          >
            {mode === 'signin'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Guest */}
          <button
            type="button"
            onClick={handleGuest}
            className="rounded-xl border border-transparent px-4 py-3 font-sans text-[13px] text-mist text-center transition-colors duration-150 hover:text-steel"
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
      <path d="M12.26.64c.08.6-.17 1.2-.52 1.66-.38.5-.99.88-1.6.83-.09-.6.19-1.21.54-1.64C11.03.97 11.68.6 12.26.64ZM14.7 6.3c-.05.03-2.03 1.02-2.01 3.35.02 2.77 2.46 3.69 2.49 3.7-.03.08-.39 1.28-1.27 2.52-.77 1.08-1.57 2.14-2.79 2.16-1.19.02-1.58-.67-2.95-.67-1.38 0-1.81.65-2.94.69-1.18.04-2.08-1.14-2.86-2.21C.84 13.7-.19 10.63.93 8.1c.55-1.25 1.56-2.04 2.69-2.06 1.17-.02 1.67.67 2.99.67 1.31 0 1.73-.67 3.13-.67 1.01.01 1.97.5 2.96 1.26Z" fill="#2B2B2B"/>
    </svg>
  )
}
