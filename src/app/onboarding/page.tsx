'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin, Shield, Calendar, User, Briefcase,
  HeartHandshake, Users, DollarSign, Tag, Minus, Plus,
} from 'lucide-react'
import { UserProfile, EMPTY_PROFILE } from '@/lib/profile'
import { useProfile } from '@/lib/profile-context'
import { useGuest } from '@/lib/guest-context'
import { createClient } from '@/lib/supabase'

/* ── Data ─────────────────────────────────────────────────── */

const CA_PROVINCES = [
  'ON', 'BC', 'QC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const IMMIGRATION_OPTIONS = [
  { value: 'citizen', label: "I'm a citizen" },
  { value: 'permanent_resident', label: "I'm a permanent resident" },
  { value: 'work_permit', label: 'I have a work permit' },
  { value: 'student_visa', label: 'I have a student visa' },
  { value: 'refugee', label: "I'm a refugee or asylum seeker" },
  { value: 'unknown', label: 'Other or prefer not to say' },
] as const

const AGE_BANDS = ['0-17', '18-25', '26-35', '36-45', '46-55', '56-64', '65+'] as const

const EMPLOYMENT_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'employed', label: 'Working' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'unemployed', label: 'Not currently working' },
  { value: 'retiree', label: 'Retired' },
] as const

const BENEFITS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: "I don't know" },
] as const

const INCOME_OPTIONS = [
  { value: 'low', label: 'Under $25,000' },
  { value: 'medium', label: '$25,000\u2013$60,000' },
  { value: 'high', label: 'Over $60,000' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

const SPECIAL_OPTIONS = [
  { value: 'refugee', label: 'Refugee' },
  { value: 'temp_foreign_worker', label: 'Temporary foreign worker' },
  { value: 'intl_student', label: 'International student' },
  { value: 'asylum_seeker', label: 'Asylum seeker' },
] as const

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const STEP_ICONS = [MapPin, Shield, Calendar, User, Briefcase, HeartHandshake, Users, DollarSign, Tag]

/* ── Helpers ──────────────────────────────────────────────── */

function Tile({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full min-h-[48px] px-4 py-3 rounded-xl border text-left font-sans text-charcoal transition-colors ${
        selected
          ? 'border-sage bg-sage/10'
          : 'border-tan bg-white hover:border-sage'
      }`}
    >
      {children}
    </button>
  )
}

/* ── Main component ───────────────────────────────────────── */

const TOTAL_STEPS = 9

export default function OnboardingPage() {
  const router = useRouter()
  const { isGuest } = useGuest()
  const { setProfile } = useProfile()

  const [step, setStep] = useState(0)
  const [profile, setLocal] = useState<UserProfile>({ ...EMPTY_PROFILE })

  // Province search
  const [search, setSearch] = useState('')

  // Residency date
  const [resMonth, setResMonth] = useState('')
  const [resYear, setResYear] = useState('')

  // Special category multi-select
  const [specialSelections, setSpecialSelections] = useState<string[]>([])
  const [noneSpecial, setNoneSpecial] = useState(false)

  // Determine if we should skip step 9 (special category)
  const skipSpecial =
    profile.immigrationStatus === 'citizen' ||
    profile.immigrationStatus === 'permanent_resident'

  const effectiveTotal = skipSpecial ? TOTAL_STEPS - 1 : TOTAL_STEPS
  const displayStep = Math.min(step + 1, effectiveTotal)

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  function next() {
    let nextStep = step + 1
    // Skip step 8 (index 8 = special category) if citizen/PR
    if (nextStep === 8 && skipSpecial) nextStep = 9
    if (nextStep >= TOTAL_STEPS) {
      setStep(TOTAL_STEPS) // show consent
    } else {
      setStep(nextStep)
    }
  }

  function skip() {
    // Set field to default/unknown and advance
    switch (step) {
      case 0: update('province', 'unknown'); break
      case 1: update('immigrationStatus', 'unknown'); break
      case 2: update('residencyStartDate', 'unknown'); break
      case 3: update('ageBand', '18-25'); break
      case 4: update('employmentStatus', 'unemployed'); break
      case 5: update('hasEmployerBenefits', 'unknown'); break
      case 6: update('dependants', { spouse: false, children: 0 }); break
      case 7: update('incomeBand', 'prefer_not_to_say'); break
      case 8: update('specialCategory', null); break
    }
    next()
  }

  function selectAndNext<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    update(key, value)
    setTimeout(next, 200)
  }

  async function handleSave() {
    if (!isGuest) {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('profiles')
            .upsert({ id: user.id, ...profile }, { onConflict: 'id' })
          await supabase
            .from('consent_log')
            .insert({ user_id: user.id, action: 'profile_saved' })
        }
      } catch {
        // Fall through to redirect
      }
    }
    setProfile(profile)
    router.push('/chat')
  }

  function handleContinueWithout() {
    setProfile(profile)
    router.push('/chat')
  }

  /* ── Render screens ─────────────────────────────────────── */

  const Icon = step < TOTAL_STEPS ? STEP_ICONS[step] : Tag

  // Consent screen
  if (step >= TOTAL_STEPS) {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <h1 className="font-display italic text-3xl text-charcoal">
            Your information stays safe.
          </h1>
          <p className="font-sans text-steel text-base max-w-sm">
            Everything is encrypted and protected. Only you can see it. Delete it all anytime.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={handleSave}
              className="h-12 rounded-xl bg-navy text-cream font-bold font-sans w-full transition-opacity hover:opacity-90"
            >
              Save my profile
            </button>
            <button
              type="button"
              onClick={handleContinueWithout}
              className="h-12 rounded-xl border border-tan text-charcoal font-medium font-sans w-full transition-colors hover:border-sage"
            >
              Continue without saving
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-silver">
        <div
          className="h-full bg-sage transition-all duration-300"
          style={{ width: `${(displayStep / effectiveTotal) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">
          {/* Question heading */}
          <div className="flex items-center gap-3">
            <Icon size={20} strokeWidth={1.5} className="text-steel shrink-0" />
            <h1 className="font-display italic text-2xl md:text-3xl text-charcoal">
              {step === 0 && 'Where do you live?'}
              {step === 1 && 'What is your immigration status?'}
              {step === 2 && 'When did you arrive?'}
              {step === 3 && 'How old are you?'}
              {step === 4 && 'What is your employment status?'}
              {step === 5 && 'Do you have employer health benefits?'}
              {step === 6 && 'Tell us about your family'}
              {step === 7 && 'What is your household income?'}
              {step === 8 && 'Do any of these apply to you?'}
            </h1>
          </div>

          {/* Step content */}
          <div className="flex flex-col gap-2">
            {/* Step 0: Province */}
            {step === 0 && (
              <>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-silver bg-white font-sans text-charcoal placeholder:text-mist focus:outline-none focus:border-sage"
                />
                <p className="text-sm font-sans text-steel font-medium mt-2">Canada</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CA_PROVINCES.filter((p) =>
                    p.toLowerCase().includes(search.toLowerCase())
                  ).map((p) => (
                    <Tile
                      key={p}
                      selected={profile.province === p}
                      onClick={() => selectAndNext('province', p)}
                    >
                      {p}
                    </Tile>
                  ))}
                </div>
                <p className="text-sm font-sans text-steel font-medium mt-4">United States</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {US_STATES.filter((s) =>
                    s.toLowerCase().includes(search.toLowerCase())
                  ).map((s) => (
                    <Tile
                      key={s}
                      selected={profile.province === s}
                      onClick={() => selectAndNext('province', s)}
                    >
                      {s}
                    </Tile>
                  ))}
                </div>
              </>
            )}

            {/* Step 1: Immigration status */}
            {step === 1 && (
              <div className="flex flex-col gap-2">
                {IMMIGRATION_OPTIONS.map(({ value, label }) => (
                  <Tile
                    key={value}
                    selected={profile.immigrationStatus === value}
                    onClick={() => selectAndNext('immigrationStatus', value)}
                  >
                    {label}
                  </Tile>
                ))}
              </div>
            )}

            {/* Step 2: Residency start date */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <select
                    value={resMonth}
                    onChange={(e) => setResMonth(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-silver bg-white font-sans text-charcoal focus:outline-none focus:border-sage"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, '0')}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={resYear}
                    onChange={(e) => setResYear(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-silver bg-white font-sans text-charcoal focus:outline-none focus:border-sage"
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    )}
                  </select>
                </div>
                {resMonth && resYear && (
                  <button
                    type="button"
                    onClick={() => {
                      update('residencyStartDate', `${resYear}-${resMonth}`)
                      next()
                    }}
                    className="h-12 rounded-xl bg-navy text-cream font-bold font-sans w-full transition-opacity hover:opacity-90"
                  >
                    Continue
                  </button>
                )}
                <Tile
                  selected={profile.residencyStartDate === 'unknown'}
                  onClick={() => selectAndNext('residencyStartDate', 'unknown')}
                >
                  I don&apos;t remember
                </Tile>
              </div>
            )}

            {/* Step 3: Age band */}
            {step === 3 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AGE_BANDS.map((band) => (
                  <Tile
                    key={band}
                    selected={profile.ageBand === band}
                    onClick={() => selectAndNext('ageBand', band)}
                  >
                    {band}
                  </Tile>
                ))}
              </div>
            )}

            {/* Step 4: Employment */}
            {step === 4 && (
              <div className="flex flex-col gap-2">
                {EMPLOYMENT_OPTIONS.map(({ value, label }) => (
                  <Tile
                    key={value}
                    selected={profile.employmentStatus === value}
                    onClick={() => selectAndNext('employmentStatus', value)}
                  >
                    {label}
                  </Tile>
                ))}
              </div>
            )}

            {/* Step 5: Employer benefits */}
            {step === 5 && (
              <div className="flex flex-col gap-2">
                {BENEFITS_OPTIONS.map(({ value, label }) => (
                  <Tile
                    key={value}
                    selected={profile.hasEmployerBenefits === value}
                    onClick={() => selectAndNext('hasEmployerBenefits', value)}
                  >
                    {label}
                  </Tile>
                ))}
              </div>
            )}

            {/* Step 6: Family / dependants */}
            {step === 6 && (
              <div className="flex flex-col gap-4">
                {/* Spouse toggle */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-tan bg-white">
                  <span className="font-sans text-charcoal">
                    Do you have a spouse or partner?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update('dependants', {
                        ...profile.dependants,
                        spouse: !profile.dependants.spouse,
                      })
                    }
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      profile.dependants.spouse ? 'bg-sage' : 'bg-silver'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                        profile.dependants.spouse ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Children stepper */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-tan bg-white">
                  <span className="font-sans text-charcoal">Children</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        update('dependants', {
                          ...profile.dependants,
                          children: Math.max(0, profile.dependants.children - 1),
                        })
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-silver text-steel hover:border-sage"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-sans text-charcoal w-6 text-center">
                      {profile.dependants.children}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        update('dependants', {
                          ...profile.dependants,
                          children: profile.dependants.children + 1,
                        })
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-silver text-steel hover:border-sage"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={next}
                  className="h-12 rounded-xl bg-navy text-cream font-bold font-sans w-full transition-opacity hover:opacity-90"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 7: Income */}
            {step === 7 && (
              <div className="flex flex-col gap-2">
                {INCOME_OPTIONS.map(({ value, label }) => (
                  <Tile
                    key={value}
                    selected={profile.incomeBand === value}
                    onClick={() => selectAndNext('incomeBand', value)}
                  >
                    {label}
                  </Tile>
                ))}
              </div>
            )}

            {/* Step 8: Special category */}
            {step === 8 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {SPECIAL_OPTIONS.map(({ value, label }) => {
                    const isSelected = specialSelections.includes(value)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setNoneSpecial(false)
                          setSpecialSelections((prev) =>
                            isSelected
                              ? prev.filter((v) => v !== value)
                              : [...prev, value]
                          )
                        }}
                        className={`px-4 py-2 rounded-full border font-sans text-sm transition-colors ${
                          isSelected
                            ? 'border-sage bg-sage/10 text-charcoal'
                            : 'border-tan bg-white text-charcoal hover:border-sage'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setNoneSpecial(true)
                      setSpecialSelections([])
                    }}
                    className={`px-4 py-2 rounded-full border font-sans text-sm transition-colors ${
                      noneSpecial
                        ? 'border-sage bg-sage/10 text-charcoal'
                        : 'border-tan bg-white text-charcoal hover:border-sage'
                    }`}
                  >
                    None of these
                  </button>
                </div>
                {(specialSelections.length > 0 || noneSpecial) && (
                  <button
                    type="button"
                    onClick={() => {
                      update(
                        'specialCategory',
                        specialSelections.length > 0
                          ? (specialSelections[0] as UserProfile['specialCategory'])
                          : null
                      )
                      next()
                    }}
                    className="h-12 rounded-xl bg-navy text-cream font-bold font-sans w-full transition-opacity hover:opacity-90 mt-2"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Skip link */}
          <button
            type="button"
            onClick={skip}
            className="text-mist font-sans text-sm hover:text-steel transition-colors self-center mt-2"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  )
}
