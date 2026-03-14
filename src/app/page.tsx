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

const TRUST_POINTS = ['Private by default', '8-language support', 'Free guest access']

const QUICK_FACTS = [
  { value: '24/7', label: 'ready when appointments feel overwhelming' },
  { value: 'Plain', label: 'guidance in simpler language' },
  { value: 'Calm', label: 'designed for stressful moments' },
]

export default function Home() {
  const router = useRouter()
  const { setGuest } = useGuest()

  const [typed, setTyped] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedLang, setSelectedLang] = useState('en')

  useEffect(() => {
    const savedLang = localStorage.getItem('lang')
    if (savedLang) setSelectedLang(savedLang)

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
      <Image
        src="https://images.unsplash.com/photo-1476703993599-0035a21b17a9?auto=format&fit=crop&w=1920&q=80"
        alt="Family walking together at sunset"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      <div className="absolute inset-0 bg-navy home-overlay" />
      <div className="absolute inset-0 ambient-grid opacity-80" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/20 to-transparent" />

      <div className="relative z-10 w-full max-w-6xl px-6 py-8 md:py-14">
        <div className="fade-rise flex flex-wrap items-center justify-center gap-2 md:justify-start">
          {TRUST_POINTS.map((point) => (
            <span
              key={point}
              className="trust-pill rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-cream/90"
            >
              {point}
            </span>
          ))}
        </div>

        <div className="mt-6 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="fade-rise delay-1 max-w-3xl text-center lg:text-left">
            <span className="home-brand text-cream">Caregiver AI</span>
            <h1 className="home-headline mt-5 text-cream">
              Never be scared to go to the
              <br />
              <span>
                {typed}
                {cursorVisible && <span className="home-cursor">|</span>}
              </span>
            </h1>
            <p className="home-subtitle mt-5 max-w-2xl text-cream/82 font-sans lg:text-lg">
              Calm, private support for families navigating care, coverage, and unfamiliar medical systems.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/auth"
                className="flex items-center justify-center h-12 px-8 rounded-xl bg-cream text-navy text-[14px] font-bold font-sans hover:bg-white"
              >
                Get started
              </Link>
              <button
                type="button"
                onClick={handleGuest}
                className="flex items-center justify-center h-12 px-8 rounded-xl border border-cream/30 text-cream bg-white/8 text-[14px] font-medium font-sans hover:bg-white/14"
              >
                Try as guest
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {QUICK_FACTS.map((fact) => (
                <div key={fact.label} className="home-stat rounded-2xl px-4 py-4 text-left text-cream">
                  <div className="font-display text-2xl italic leading-none">{fact.value}</div>
                  <p className="mt-2 text-[12px] leading-5 text-cream/72 font-sans">{fact.label}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="fade-rise delay-2 glass-panel rounded-[28px] p-5 text-left sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow text-cream/70">Choose your language</p>
                <h2 className="mt-2 font-display text-[30px] italic leading-tight text-cream">
                  Start in the language that feels most comfortable.
                </h2>
              </div>
            </div>

            <p className="mt-3 font-sans text-[14px] leading-6 text-cream/76">
              We save your preference locally now and to your profile later if you sign in.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLang(code)}
                  className={`rounded-xl border px-3 py-3 text-[14px] text-center font-sans ${
                    selectedLang === code
                      ? 'lang-card-active bg-cream text-charcoal'
                      : 'lang-card bg-white/92 text-charcoal hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <p className="absolute bottom-4 inset-x-0 text-center text-mist font-sans home-disclaimer">
        This is not medical advice. In an emergency, call 911.
      </p>
    </main>
  )
}
