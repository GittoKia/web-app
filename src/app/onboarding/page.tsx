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
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'QC', label: 'Quebec' },
  { value: 'AB', label: 'Alberta' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'YT', label: 'Yukon' },
  { value: 'NU', label: 'Nunavut' },
]

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'Washington DC' },
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
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STEP_ICONS = [MapPin, Shield, Calendar, User, Briefcase, HeartHandshake, Users, DollarSign, Tag]

const STEP_TITLES = [
  'Where do you live?',
  'What is your immigration status?',
  'When did you arrive?',
  'How old are you?',
  'What is your employment status?',
  'Do you have employer health benefits?',
  'Tell us about your family',
  'What is your household income?',
  'Do any of these apply to you?',
]

/* ── Tile component ───────────────────────────────────────── */

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
      className={`flex items-center gap-3 w-full min-h-[48px] px-4 py-3 rounded-xl border text-start font-sans text-[14px] text-charcoal transition-colors duration-150 ${
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

  // Residency date
  const [resMonth, setResMonth] = useState('')
  const [resYear, setResYear] = useState('')

  // Special category multi-select
  const [specialSelections, setSpecialSelections] = useState<string[]>([])
  const [noneSpecial, setNoneSpecial] = useState(false)

  // Skip step 9 (special category) if citizen/PR
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
    if (nextStep === 8 && skipSpecial) nextStep = 9
    if (nextStep >= TOTAL_STEPS) {
      setStep(TOTAL_STEPS)
    } else {
      setStep(nextStep)
    }
  }

  function skip() {
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
    setTimeout(next, 150)
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
        // Fall through
      }
    }
    setProfile(profile)
    router.push('/chat')
  }

  function handleContinueWithout() {
    setProfile(profile)
    router.push('/chat')
  }

  const Icon = step < TOTAL_STEPS ? STEP_ICONS[step] : Tag

  /* ── Consent screen ─────────────────────────────────────── */

  if (step >= TOTAL_STEPS) {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <h1 className="onboarding-heading text-charcoal">
            Your information stays safe.
          </h1>
          <p className="font-sans text-[15px] leading-[1.6] text-steel max-w-sm">
            Everything is encrypted and protected. Only you can see it. Delete it all anytime.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={handleSave}
              className="h-12 rounded-xl bg-navy text-cream text-[14px] font-bold font-sans w-full transition-colors duration-150 hover:bg-navy-hover"
            >
              Save my profile
            </button>
            <button
              type="button"
              onClick={handleContinueWithout}
              className="h-12 rounded-xl border border-tan text-charcoal text-[14px] font-medium font-sans w-full transition-colors duration-150 hover:border-sage"
            >
              Continue without saving
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* ── Step screens ───────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-cream flex flex-col">
      {/* Progress bar — 4px, sage fill, silver track */}
      <div className="w-full h-1 bg-silver">
        <div
          className="h-full bg-sage transition-all duration-300"
          style={{ width: `${(displayStep / effectiveTotal) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-[640px] mx-auto flex flex-col gap-4">

          {/* Heading with icon */}
          <div className="flex items-center gap-3">
            <Icon size={20} strokeWidth={1.5} className="text-steel shrink-0" />
            <h1 className="onboarding-heading text-charcoal">
              {STEP_TITLES[step]}
            </h1>
          </div>

          {/* Step content */}
          <div className="flex flex-col gap-3">

            {/* ── Step 0: Province (dropdown) ──────────────── */}
            {step === 0 && (
              <div className="flex flex-col gap-3">
                <select
                  value={profile.province === 'unknown' ? '' : profile.province}
                  onChange={(e) => {
                    if (e.target.value) selectAndNext('province', e.target.value)
                  }}
                  className="w-full h-12 px-4 rounded-xl border border-tan bg-white font-sans text-[14px] text-charcoal transition-colors duration-150 focus:outline-none focus:border-sage appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select your province or state</option>
                  <optgroup label="Canada">
                    {CA_PROVINCES.map(({ value, label }) => (
                      <option key={value} value={value}>{label} ({value})</option>
                    ))}
                  </optgroup>
                  <optgroup label="United States">
                    {US_STATES.map(({ value, label }) => (
                      <option key={value} value={value}>{label} ({value})</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* ── Step 1: Immigration status ───────────────── */}
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

            {/* ── Step 2: Residency start date ─────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <select
                    value={resMonth}
                    onChange={(e) => setResMonth(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-tan bg-white font-sans text-[14px] text-charcoal transition-colors duration-150 focus:outline-none focus:border-sage"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={resYear}
                    onChange={(e) => setResYear(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-tan bg-white font-sans text-[14px] text-charcoal transition-colors duration-150 focus:outline-none focus:border-sage"
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {resMonth && resYear && (
                  <button
                    type="button"
                    onClick={() => {
                      update('residencyStartDate', `${resYear}-${resMonth}`)
                      next()
                    }}
                    className="h-12 rounded-xl bg-navy text-cream text-[14px] font-bold font-sans w-full transition-colors duration-150 hover:bg-navy-hover"
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

            {/* ── Step 3: Age band ─────────────────────────── */}
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

            {/* ── Step 4: Employment ───────────────────────── */}
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

            {/* ── Step 5: Employer benefits ────────────────── */}
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

            {/* ── Step 6: Family / dependants ──────────────── */}
            {step === 6 && (
              <div className="flex flex-col gap-3">
                {/* Spouse toggle */}
                <div className="flex items-center justify-between px-4 py-4 rounded-xl border border-tan bg-white">
                  <span className="font-sans text-[14px] text-charcoal">
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
                    className={`relative w-12 h-7 rounded-full transition-colors duration-150 ${
                      profile.dependants.spouse ? 'bg-sage' : 'bg-silver'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 start-0.5 w-6 h-6 rounded-full bg-white transition-transform duration-150 ${
                        profile.dependants.spouse ? 'ltr:translate-x-5 rtl:-translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Children stepper */}
                <div className="flex items-center justify-between px-4 py-4 rounded-xl border border-tan bg-white">
                  <span className="font-sans text-[14px] text-charcoal">Children</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        update('dependants', {
                          ...profile.dependants,
                          children: Math.max(0, profile.dependants.children - 1),
                        })
                      }
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-tan text-steel transition-colors duration-150 hover:border-sage"
                    >
                      <Minus size={16} strokeWidth={1.5} />
                    </button>
                    <span className="font-sans text-[15px] text-charcoal w-6 text-center">
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
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-tan text-steel transition-colors duration-150 hover:border-sage"
                    >
                      <Plus size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={next}
                  className="h-12 rounded-xl bg-navy text-cream text-[14px] font-bold font-sans w-full transition-colors duration-150 hover:bg-navy-hover"
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Step 7: Income ───────────────────────────── */}
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

            {/* ── Step 8: Special category (chips) ─────────── */}
            {step === 8 && (
              <div className="flex flex-col gap-3">
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
                        className={`px-4 py-2 rounded-full border font-sans text-[13px] transition-colors duration-150 ${
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
                    className={`px-4 py-2 rounded-full border font-sans text-[13px] transition-colors duration-150 ${
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
                    className="h-12 rounded-xl bg-navy text-cream text-[14px] font-bold font-sans w-full transition-colors duration-150 hover:bg-navy-hover"
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
            className="text-mist font-sans text-[13px] transition-colors duration-150 hover:text-steel self-center mt-2"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="py-4 text-center text-mist font-sans text-[11px] leading-[1.4]">
        This is not medical advice. In an emergency, call 911.
      </p>
    </main>
  )
}
