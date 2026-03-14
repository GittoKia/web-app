import 'server-only'

/**
 * CMS Healthcare.gov Marketplace API client.
 * Free tier — requires API key from https://developer.cms.gov/
 * Endpoint: https://marketplace.api.healthcare.gov/api/v1/
 */

const CMS_BASE_URL = 'https://marketplace.api.healthcare.gov/api/v1'
const CMS_API_KEY = process.env.CMS_API_KEY ?? ''

export type CmsPlan = {
  id: string
  name: string
  issuer: { name: string }
  metal_level: string
  type: string
  premium: number
  deductibles: Array<{ amount: number; type: string; family_cost: string }>
  moops: Array<{ amount: number; type: string; family_cost: string }>
  benefits: Array<{
    name: string
    covered: boolean
    cost_sharings: Array<{ coinsurance_rate: number; copay_amount: number; network_tier: string }>
  }>
  formulary_url?: string
  provider_directory_url?: string
  brochure_url?: string
  quality_rating?: { global_rating: number }
}

export type CmsSearchResult = {
  plans: CmsPlan[]
  total: number
  facet_groups?: Array<{
    name: string
    facets: Array<{ value: string; count: number }>
  }>
}

export type CmsPlanSearchParams = {
  zipCode: string
  fips?: string
  income?: number
  people?: Array<{
    age: number
    is_pregnant?: boolean
    uses_tobacco?: boolean
    has_mec?: boolean
    aptc_eligible?: boolean
  }>
  market?: 'Individual' | 'SmallGroup'
  year?: number
  limit?: number
  offset?: number
}

function extractDeductible(plan: CmsPlan): number {
  const individual = plan.deductibles?.find(
    (d) => d.family_cost === 'Individual' && d.type === 'Medical EHB Deductible'
  )
  return individual?.amount ?? plan.deductibles?.[0]?.amount ?? 0
}

function extractMoop(plan: CmsPlan): number {
  const individual = plan.moops?.find(
    (m) => m.family_cost === 'Individual' && m.type === 'Maximum Out of Pocket for Medical EHB Benefits'
  )
  return individual?.amount ?? plan.moops?.[0]?.amount ?? 0
}

export async function searchPlans(params: CmsPlanSearchParams): Promise<CmsSearchResult> {
  if (!CMS_API_KEY) {
    throw new Error('CMS_API_KEY is required. Get a free key at https://developer.cms.gov/')
  }

  const year = params.year ?? new Date().getFullYear()
  const people = params.people ?? [{ age: 30 }]

  const url = new URL(`${CMS_BASE_URL}/plans/search`)
  url.searchParams.set('apikey', CMS_API_KEY)
  url.searchParams.set('year', String(year))
  url.searchParams.set('zipcode', params.zipCode)
  if (params.fips) {
    url.searchParams.set('fips', params.fips)
  }
  url.searchParams.set('market', params.market ?? 'Individual')
  url.searchParams.set('limit', String(params.limit ?? 10))
  url.searchParams.set('offset', String(params.offset ?? 0))

  if (params.income) {
    url.searchParams.set('income', String(params.income))
  }

  // Add household members
  people.forEach((person, i) => {
    url.searchParams.append(`aptc_eligible`, String(person.aptc_eligible ?? false))
    url.searchParams.append(`age`, String(person.age))
    if (person.is_pregnant) url.searchParams.append(`is_pregnant`, 'true')
    if (person.uses_tobacco) url.searchParams.append(`uses_tobacco`, 'true')
    if (person.has_mec) url.searchParams.append(`has_mec`, 'true')
  })

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`CMS API error ${response.status}: ${text.slice(0, 200)}`)
  }

  return response.json() as Promise<CmsSearchResult>
}

/**
 * Normalize a CMS plan into our app's format for display and LLM context.
 */
export function normalizeCmsPlan(plan: CmsPlan) {
  return {
    id: plan.id,
    name: plan.name,
    carrier: plan.issuer?.name ?? 'Unknown Issuer',
    metalTier: plan.metal_level?.toLowerCase() ?? 'unknown',
    planType: plan.type ?? 'Unknown',
    monthlyPremium: Math.round(plan.premium ?? 0),
    deductible: extractDeductible(plan),
    maxOutOfPocket: extractMoop(plan),
    qualityRating: plan.quality_rating?.global_rating ?? null,
    formularyUrl: plan.formulary_url ?? null,
    providerDirectoryUrl: plan.provider_directory_url ?? null,
    brochureUrl: plan.brochure_url ?? null,
    benefits: (plan.benefits ?? []).slice(0, 15).map((b) => ({
      name: b.name,
      covered: b.covered,
      copay: b.cost_sharings?.[0]?.copay_amount ?? null,
      coinsurance: b.cost_sharings?.[0]?.coinsurance_rate ?? null,
    })),
  }
}

export type NormalizedPlan = ReturnType<typeof normalizeCmsPlan>
