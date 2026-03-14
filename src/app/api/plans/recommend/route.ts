import { NextResponse } from 'next/server'
import { z } from 'zod'
import { searchPlans, normalizeCmsPlan, type NormalizedPlan } from '@/lib/cms-marketplace'
import { searchProviders, normalizeProvider } from '@/lib/npi-registry'
import { lookupDrug, type DrugLookupResult } from '@/lib/rxnorm-client'
import { generateChatText } from '@/lib/llm-client'

export const runtime = 'nodejs'

const schema = z.object({
  zip: z.string().min(5).max(5),
  age: z.number().int().positive().optional().default(30),
  income: z.number().positive().optional(),
  householdSize: z.number().int().positive().optional().default(1),
  medications: z.array(z.string()).optional().default([]),
  providers: z.array(z.string()).optional().default([]),
  maxMonthlyPremium: z.number().positive().optional(),
  usesTobacco: z.boolean().optional().default(false),
})

/**
 * Parse a provider search string into first/last name or org name.
 */
function parseProviderQuery(query: string) {
  const trimmed = query.trim()

  // If it contains "Dr." or has two+ words that look like a person name
  const drMatch = trimmed.match(/^(?:Dr\.?\s+)?(\w+)\s+(.+)/i)
  if (drMatch) {
    return { firstName: drMatch[1], lastName: drMatch[2] }
  }

  // Likely an organization name
  return { organizationName: trimmed }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 })
  }

  const { zip, age, income, householdSize, medications, providers, maxMonthlyPremium, usesTobacco } = parsed.data

  try {
    // Run all API calls in parallel
    const [cmsResult, drugResults, providerResults] = await Promise.all([
      // 1. CMS Marketplace — search plans by ZIP
      searchPlans({
        zipCode: zip,
        income,
        people: [{ age, uses_tobacco: usesTobacco }],
        limit: 10,
      }).catch((err) => {
        console.error('CMS API error:', err)
        return { plans: [] as never[], total: 0 }
      }),

      // 2. RxNorm + OpenFDA — look up each medication
      Promise.all(
        medications.slice(0, 5).map(async (med): Promise<DrugLookupResult> => {
          try {
            return await lookupDrug(med)
          } catch {
            return {
              query: med,
              rxcui: null,
              normalizedName: med,
              brandNames: [],
              genericNames: [],
              purpose: null,
              warnings: [],
              interactions: [],
            }
          }
        })
      ),

      // 3. NPI Registry — look up each provider
      Promise.all(
        providers.slice(0, 3).map((prov) => {
          const params = parseProviderQuery(prov)
          return searchProviders({ ...params, postalCode: zip, limit: 3 }).catch(() => ({
            result_count: 0,
            results: [],
          }))
        })
      ),
    ])

    // Normalize CMS plans
    const normalizedPlans = cmsResult.plans.map(normalizeCmsPlan)

    // Filter by budget if specified
    const filteredPlans = maxMonthlyPremium
      ? normalizedPlans.filter((p) => p.monthlyPremium <= maxMonthlyPremium)
      : normalizedPlans

    // Normalize provider results
    const foundProviders = providerResults.flatMap((r) =>
      r.results.slice(0, 2).map(normalizeProvider)
    )

    // Build LLM context for personalized ranking
    const llmContext = buildLlmContext({
      plans: filteredPlans,
      drugs: drugResults,
      providers: foundProviders,
      zip,
      age,
      income,
      householdSize,
    })

    // Ask Groq to rank and explain
    let recommendations: RankedRecommendation[] = []

    if (filteredPlans.length > 0) {
      recommendations = await generateRecommendations(llmContext, filteredPlans)
    }

    return NextResponse.json({
      ok: true,
      plans: recommendations.length > 0
        ? recommendations
        : filteredPlans.map((p) => ({
            ...p,
            score: 0,
            matchReasons: ['Matches your ZIP code and budget filters'],
            explanation: 'This plan is available in your area.',
          })),
      drugInfo: drugResults.map((d) => ({
        query: d.query,
        normalizedName: d.normalizedName,
        brandNames: d.brandNames,
        purpose: d.purpose,
        interactionCount: d.interactions.length,
      })),
      providerInfo: foundProviders,
      totalPlansAvailable: cmsResult.total,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recommendations.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type RankedRecommendation = NormalizedPlan & {
  score: number
  matchReasons: string[]
  explanation: string
}

function buildLlmContext(params: {
  plans: NormalizedPlan[]
  drugs: DrugLookupResult[]
  providers: Array<ReturnType<typeof normalizeProvider>>
  zip: string
  age: number
  income?: number
  householdSize: number
}) {
  const planSummaries = params.plans.map((p, i) => {
    const benefits = p.benefits
      .filter((b) => b.covered)
      .slice(0, 5)
      .map((b) => `${b.name}: $${b.copay ?? 0} copay`)
      .join(', ')

    return `Plan ${i + 1}: ${p.name} (${p.carrier})
  Tier: ${p.metalTier}, Type: ${p.planType}
  Premium: $${p.monthlyPremium}/mo, Deductible: $${p.deductible}, Max OOP: $${p.maxOutOfPocket}
  Key benefits: ${benefits || 'See brochure'}
  Rating: ${p.qualityRating ? `${p.qualityRating}/5` : 'Not rated'}`
  })

  const drugSummaries = params.drugs.map((d) => {
    const interactions = d.interactions.length
      ? `Interactions: ${d.interactions.map((i) => i.interactingDrug).join(', ')}`
      : 'No known interactions'
    return `${d.normalizedName} (searched: "${d.query}") — ${d.purpose ?? 'Purpose not found'}. ${interactions}`
  })

  const providerSummaries = params.providers.map((p) =>
    `${p.name}${p.credential ? `, ${p.credential}` : ''} — ${p.specialty ?? 'General'}, ${p.address?.city ?? ''} ${p.address?.state ?? ''} ${p.address?.zip ?? ''}`
  )

  return `User profile:
- ZIP: ${params.zip}, Age: ${params.age}, Household: ${params.householdSize}
${params.income ? `- Annual income: $${params.income}` : '- Income: not provided'}

Medications the user takes:
${drugSummaries.length ? drugSummaries.join('\n') : 'None specified'}

Providers the user wants to keep:
${providerSummaries.length ? providerSummaries.join('\n') : 'None specified'}

Available plans:
${planSummaries.join('\n\n')}`
}

async function generateRecommendations(
  context: string,
  plans: NormalizedPlan[],
): Promise<RankedRecommendation[]> {
  const text = await generateChatText({
    system: `You are a healthcare plan advisor. Given a user's profile, medications, providers, and available insurance plans, rank the plans from best to worst fit.

For each plan, provide:
1. A score from 0-100 (higher = better fit)
2. 1-3 specific match reasons (e.g., "Low deductible suits your medication needs")
3. A 1-2 sentence personalized explanation

Return ONLY valid JSON in this exact format (no markdown, no commentary):
[
  {
    "planIndex": 0,
    "score": 85,
    "matchReasons": ["reason1", "reason2"],
    "explanation": "..."
  }
]

Consider: medication coverage likelihood (based on plan tier and formulary), provider network breadth for the plan type (HMO vs PPO), premium affordability relative to income, deductible and out-of-pocket exposure, quality ratings.`,
    messages: [
      {
        role: 'user',
        content: `Rank these plans for me:\n\n${context}`,
      },
    ],
    maxTokens: 1500,
  })

  try {
    // Strip any markdown fencing or reasoning blocks
    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()

    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start < 0 || end < 0) throw new Error('No JSON array found')

    const rankings = JSON.parse(cleaned.slice(start, end + 1)) as Array<{
      planIndex: number
      score: number
      matchReasons: string[]
      explanation: string
    }>

    // Merge rankings back into plans
    return rankings
      .filter((r) => r.planIndex >= 0 && r.planIndex < plans.length)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        ...plans[r.planIndex],
        score: r.score,
        matchReasons: r.matchReasons,
        explanation: r.explanation,
      }))
  } catch {
    // LLM returned unparseable response — return plans unranked
    return plans.map((p, i) => ({
      ...p,
      score: plans.length - i,
      matchReasons: ['Available in your area'],
      explanation: 'This plan matches your ZIP code and filters.',
    }))
  }
}
