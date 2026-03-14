'use client'

import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '@/lib/profile-context'

type RecommendedPlan = {
  id: string
  planCode: string
  name: string
  carrier: string
  state: string
  metalTier: string
  planType: string
  monthlyPremium: number
  deductible: number
  maxOutOfPocket: number
  score: number
  countyFips: string | null
  matchReasons: string[]
  explanation: string
}

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

function inferStateFromProfileProvince(province: string | null | undefined) {
  if (!province) {
    return ''
  }

  return STATE_NAME_BY_CODE[province] ?? ''
}

export function PlanRecommendationPanel() {
  const { profile } = useProfile()
  const [zip, setZip] = useState('10001')
  const [medications, setMedications] = useState('Metformin')
  const [providers, setProviders] = useState('Dr. Avery Caldwell Hudson Medical Group')
  const [plans, setPlans] = useState<RecommendedPlan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const inferredState = useMemo(() => inferStateFromProfileProvince(profile?.province), [profile?.province])

  useEffect(() => {
    if (!inferredState && !plans.length) {
      return
    }
  }, [inferredState, plans.length])

  async function handleRecommend() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/plans/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: inferredState || 'New York',
          zip,
          medications: medications.split(',').map((item) => item.trim()).filter(Boolean),
          providers: providers.split(',').map((item) => item.trim()).filter(Boolean),
          maxMonthlyPremium: 560,
        }),
      })

      const payload = (await response.json()) as { plans?: RecommendedPlan[]; error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load recommendations.')
      }

      setPlans(payload.plans ?? [])
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="surface-panel rounded-card flex flex-col gap-4 p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="section-eyebrow text-steel">Plan matching</p>
        <h2 className="font-playfair text-[30px] italic leading-tight text-charcoal">
          Find plans by ZIP, medications, and providers.
        </h2>
        <p className="font-sans text-[15px] leading-7 text-steel">
          Recommendations use your saved onboarding location when available, then rank mock plans with ZIP-to-county resolution and formulary/provider matches.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="font-sans text-[13px] font-medium text-charcoal">ZIP code</span>
          <input value={zip} onChange={(event) => setZip(event.target.value)} className="input-field" />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="font-sans text-[13px] font-medium text-charcoal">Medications</span>
          <input value={medications} onChange={(event) => setMedications(event.target.value)} className="input-field" />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-sans text-[13px] font-medium text-charcoal">Preferred providers</span>
        <input value={providers} onChange={(event) => setProviders(event.target.value)} className="input-field" />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={handleRecommend} className="btn-primary sm:max-w-[240px]" disabled={isLoading}>
          {isLoading ? 'Ranking plans...' : 'Find recommendations'}
        </button>
        <p className="font-sans text-[13px] text-steel">
          Using state: <span className="font-medium text-charcoal">{inferredState || 'New York fallback'}</span>
        </p>
        {error ? <p className="font-sans text-[14px] text-coral">{error}</p> : null}
      </div>

      <div className="grid gap-3">
        {plans.length ? (
          plans.slice(0, 6).map((plan) => (
            <div key={plan.id} className="rounded-card border border-tan bg-cream p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-sans text-[15px] font-medium text-charcoal">{plan.name}</p>
                  <p className="font-sans text-[13px] leading-6 text-steel">
                    {plan.carrier} · {plan.metalTier} · {plan.planType}
                  </p>
                </div>
                <p className="font-sans text-[12px] uppercase tracking-[0.18em] text-steel">Score {plan.score}</p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <p className="font-sans text-[13px] text-steel">Premium: <span className="text-charcoal">${plan.monthlyPremium}/mo</span></p>
                <p className="font-sans text-[13px] text-steel">Deductible: <span className="text-charcoal">${plan.deductible}</span></p>
                <p className="font-sans text-[13px] text-steel">Max OOP: <span className="text-charcoal">${plan.maxOutOfPocket}</span></p>
              </div>

              <p className="mt-3 font-sans text-[13px] leading-6 text-steel">{plan.explanation}</p>
              <p className="mt-2 font-sans text-[13px] leading-6 text-steel">{plan.matchReasons.join(' • ')}</p>
            </div>
          ))
        ) : (
          <div className="rounded-card border border-dashed border-tan bg-cream p-4 font-sans text-[14px] leading-6 text-steel">
            No recommendations yet. Run a ZIP-based search to see ranked plan matches.
          </div>
        )}
      </div>
    </section>
  )
}
