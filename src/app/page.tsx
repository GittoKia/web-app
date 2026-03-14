'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useGuest } from '@/lib/guest-context'
import { createClient } from '@/lib/supabase'

const WORD = 'Hospital'
const TICK_MS = 120
const BLINK_AFTER_MS = 1200

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'pt', label: 'Português' },
]

export default function Home() {
  const router = useRouter()
  const { setGuest } = useGuest()

  const [typed, setTyped] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedLang, setSelectedLang] = useState('en')

  useEffect(() => {
    let index = 0
    intervalRef.current = setInterval(() => {
      index += 1
      setTyped(WORD.slice(0, index))
      if (index === WORD.length) {
        clearInterval(intervalRef.current!)
        setTimeout(() => setCursorVisible(false), BLINK_AFTER_MS)
      }
    }, TICK_MS)
    return () => clearInterval(intervalRef.current!)
  }, [])

  async function handleLang(code: string) {
    setSelectedLang(code)
    localStorage.setItem('lang', code)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, language: code }, { onConflict: 'id' })
      }
    } catch {
      // Supabase not configured
    }
  }

  function handleGuest() {
    setGuest()
    router.push('/onboarding')
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background photo */}
      <Image
        src="https://images.unsplash.com/photo-1476703993599-0035a21b17a9?auto=format&fit=crop&w=1920&q=80"
        alt="Family walking together at sunset"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      {/* Navy overlay 70% */}
      <div className="absolute inset-0 bg-navy home-overlay" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 gap-8 w-full max-w-3xl">

        {/* Brand — Playfair Display italic */}
        <span className="home-brand text-cream">
          Caregiver AI
        </span>

        {/* Headline — Playfair Display italic, 32px mobile / 48px desktop */}
        <h1 className="home-headline text-cream">
          Never be scared to go to the
          <br />
          <span>
            {typed}
            {cursorVisible && <span className="home-cursor">|</span>}
          </span>
        </h1>

        {/* Subtitle — DM Sans 16px, steel */}
        <p className="home-subtitle text-steel font-sans max-w-md">
          Your health companion — confidential, multilingual, free.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:justify-center">
          <Link
            href="/auth"
            className="flex items-center justify-center h-12 px-8 rounded-xl bg-navy text-cream text-[14px] font-bold font-sans transition-colors duration-150 hover:bg-navy-hover"
          >
            Get started
          </Link>
          <button
            type="button"
            onClick={handleGuest}
            className="flex items-center justify-center h-12 px-8 rounded-xl border border-tan text-charcoal bg-white text-[14px] font-medium font-sans transition-colors duration-150 hover:border-sage"
          >
            Try as guest
          </button>
        </div>

        {/* Language selector — white cards, tan border, sage active */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => handleLang(code)}
              className={`bg-white text-charcoal text-[14px] text-center py-3 px-2 rounded-xl border font-sans transition-colors duration-150 ${
                selectedLang === code ? 'lang-card-active' : 'lang-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer — DM Sans 11px, mist */}
      <p className="absolute bottom-4 inset-x-0 text-center text-mist font-sans home-disclaimer">
        This is not medical advice. In an emergency, call 911.
      </p>
    </main>
  )
}
