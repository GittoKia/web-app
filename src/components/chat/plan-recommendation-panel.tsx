'use client'

import { useState } from 'react'
import { useProfile } from '@/lib/profile-context'

type RecommendedPlan = {
  id: string
  name: string
  carrier: string
  metalTier: string
  planType: string
  monthlyPremium: number
  deductible: number
  maxOutOfPocket: number
  qualityRating: number | null
  formularyUrl: string | null
  providerDirectoryUrl: string | null
  brochureUrl: string | null
  score: number
  matchReasons: string[]
  explanation: string
}

type DrugInfo = {
  query: string
  normalizedName: string
  brandNames: string[]
  purpose: string | null
  interactionCount: number
}

type ProviderInfo = {
  npi: number
  name: string
  credential: string | null
  specialty: string | null
  address: {
    city: string
    state: string
    zip: string
    phone: string | null
  } | null
  isOrganization: boolean
}

const AGE_BAND_MIDPOINTS: Record<string, number> = {
  '0-17': 10,
  '18-25': 22,
  '26-35': 30,
  '36-45': 40,
  '46-55': 50,
  '56-64': 60,
  '65+': 67,
}

export function PlanRecommendationPanel() {
  const { profile } = useProfile()
  const [zip, setZip] = useState('')
  const [medications, setMedications] = useState('')
  const [providers, setProviders] = useState('')
  const [plans, setPlans] = useState<RecommendedPlan[]>([])
  const [drugInfo, setDrugInfo] = useState<DrugInfo[]>([])
  const [providerInfo, setProviderInfo] = useState<ProviderInfo[]>([])
  const [totalAvailable, setTotalAvailable] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRecommend() {
    const trimmedZip = zip.trim()
    if (!trimmedZip || trimmedZip.length !== 5) {
      setError('Enter a valid 5-digit ZIP code.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const age = profile?.ageBand
        ? AGE_BAND_MIDPOINTS[profile.ageBand] ?? 30
        : 30

      const response = await fetch('/api/plans/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip: trimmedZip,
          age,
          medications: medications.split(',').map((s) => s.trim()).filter(Boolean),
          providers: providers.split(',').map((s) => s.trim()).filter(Boolean),
          maxMonthlyPremium: 800,
        }),
      })

      const payload = (await response.json()) as {
        plans?: RecommendedPlan[]
        drugInfo?: DrugInfo[]
        providerInfo?: ProviderInfo[]
        totalPlansAvailable?: number
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load recommendations.')
      }

      setPlans(payload.plans ?? [])
      setDrugInfo(payload.drugInfo ?? [])
      setProviderInfo(payload.providerInfo ?? [])
      setTotalAvailable(payload.totalPlansAvailable ?? 0)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="surface-panel rounded-card flex flex-col gap-4 p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="section-eyebrow text-driftwood">Live plan search</p>
        <h2 className="font-cormorant text-[30px] italic leading-tight text-espresso">
          Find real plans by ZIP code.
        </h2>
        <p className="font-serif text-[15px] leading-[1.7] text-driftwood">
          Plans come from the CMS Healthcare.gov Marketplace API. Medications are verified against RxNorm and OpenFDA. Providers are looked up in the NPI Registry.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="font-serif text-[13px] font-medium text-espresso">ZIP code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g. 77001"
            maxLength={5}
            className="input-field"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="font-serif text-[13px] font-medium text-espresso">Medications (comma-separated)</span>
          <input
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            placeholder="e.g. Metformin, Lisinopril"
            className="input-field"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-serif text-[13px] font-medium text-espresso">Preferred providers (comma-separated)</span>
        <input
          value={providers}
          onChange={(e) => setProviders(e.target.value)}
          placeholder="e.g. Dr. Sarah Chen, Memorial Hospital"
          className="input-field"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={handleRecommend} className="btn-primary sm:max-w-[240px]" disabled={isLoading}>
          {isLoading ? 'Searching live APIs...' : 'Find plans'}
        </button>
        {totalAvailable > 0 && (
          <p className="font-serif text-[13px] text-driftwood">
            {totalAvailable} plans available in this area
          </p>
        )}
        {error ? <p className="font-serif text-[14px] text-terracotta">{error}</p> : null}
      </div>

      {/* Drug info cards */}
      {drugInfo.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-serif text-[12px] font-medium uppercase tracking-[0.18em] text-driftwood">Medication details (RxNorm / FDA)</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drugInfo.map((drug) => (
              <div key={drug.query} className="rounded-card border border-biscuit bg-parchment p-3">
                <p className="font-cormorant italic text-[16px] text-espresso">{drug.normalizedName}</p>
                {drug.brandNames.length > 0 && (
                  <p className="font-serif text-[12px] text-driftwood">Brands: {drug.brandNames.slice(0, 3).join(', ')}</p>
                )}
                {drug.purpose && (
                  <p className="mt-1 font-serif text-[12px] leading-[1.5] text-driftwood">{drug.purpose.slice(0, 120)}</p>
                )}
                {drug.interactionCount > 0 && (
                  <p className="mt-1 font-serif text-[11px] text-terracotta">{drug.interactionCount} known interaction(s)</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider info cards */}
      {providerInfo.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-serif text-[12px] font-medium uppercase tracking-[0.18em] text-driftwood">Provider details (NPI Registry)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {providerInfo.map((prov) => (
              <div key={prov.npi} className="rounded-card border border-biscuit bg-parchment p-3">
                <p className="font-cormorant italic text-[16px] text-espresso">
                  {prov.name}{prov.credential ? `, ${prov.credential}` : ''}
                </p>
                <p className="font-serif text-[12px] text-driftwood">{prov.specialty ?? 'General Practice'}</p>
                {prov.address && (
                  <p className="font-serif text-[12px] text-driftwood">
                    {prov.address.city}, {prov.address.state} {prov.address.zip}
                  </p>
                )}
                <p className="font-serif text-[11px] text-sandstone">NPI: {prov.npi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-3">
        {plans.length ? (
          plans.slice(0, 6).map((plan, index) => (
            <div
              key={plan.id}
              className={`rounded-card border bg-parchment p-5 stagger-item ${
                index === 0 ? 'border-sage' : 'border-biscuit'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-cormorant italic text-[18px] leading-tight text-espresso">{plan.name}</p>
                  <p className="font-serif text-[13px] leading-6 text-driftwood">
                    {plan.carrier} · {plan.metalTier} · {plan.planType}
                    {plan.qualityRating ? ` · ${plan.qualityRating}/5 stars` : ''}
                  </p>
                </div>
                <p className="font-serif text-[12px] uppercase tracking-[0.18em] text-sandstone">
                  Score {plan.score}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="font-serif text-[12px] text-driftwood">Premium</p>
                  <p className="font-serif text-[28px] font-bold text-espresso">${plan.monthlyPremium}<span className="text-[13px] font-normal text-driftwood">/mo</span></p>
                </div>
                <p className="font-serif text-[13px] text-driftwood">Deductible: <span className="text-espresso">${plan.deductible.toLocaleString()}</span></p>
                <p className="font-serif text-[13px] text-driftwood">Max OOP: <span className="text-espresso">${plan.maxOutOfPocket.toLocaleString()}</span></p>
              </div>

              <p className="mt-3 font-serif text-[13px] leading-[1.6] text-driftwood">{plan.explanation}</p>
              <p className="mt-2 font-serif text-[13px] leading-[1.6] text-driftwood">{plan.matchReasons.join(' · ')}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {plan.brochureUrl && (
                  <a href={plan.brochureUrl} target="_blank" rel="noopener noreferrer" className="font-serif text-[12px] text-sage underline">Plan brochure</a>
                )}
                {plan.formularyUrl && (
                  <a href={plan.formularyUrl} target="_blank" rel="noopener noreferrer" className="font-serif text-[12px] text-sage underline">Drug formulary</a>
                )}
                {plan.providerDirectoryUrl && (
                  <a href={plan.providerDirectoryUrl} target="_blank" rel="noopener noreferrer" className="font-serif text-[12px] text-sage underline">Provider directory</a>
                )}
              </div>
            </div>
          ))
        ) : !isLoading ? (
          <div className="rounded-card border border-dashed border-biscuit bg-parchment p-4 font-serif text-[14px] leading-6 text-driftwood">
            Enter your ZIP code and click "Find plans" to search the CMS Marketplace.
          </div>
        ) : null}
      </div>

      {plans.length > 0 && (
        <p className="font-serif text-[11px] leading-[1.5] text-sandstone">
          Plan data from CMS Healthcare.gov Marketplace API. Premiums shown before subsidies. Verify details at healthcare.gov before enrolling.
        </p>
      )}
    </section>
  )
}
