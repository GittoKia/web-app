import 'server-only'

import { Plan, MetalTier, PlanType } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { lookupCountyByZip } from '@/lib/zip-county'

export type PlanRecommendationInput = {
  state?: string
  zip?: string
  metalTier?: MetalTier
  planType?: PlanType
  medications?: string[]
  providers?: string[]
  maxMonthlyPremium?: number
}

export type RankedPlan = Plan & {
  score: number
  countyFips: string | null
  matchReasons: string[]
  explanation: string
}

function includesNormalized(values: unknown, candidate: string) {
  if (!Array.isArray(values)) {
    return false
  }

  const normalizedCandidate = candidate.trim().toLowerCase()
  return values.some((value) => String(value).trim().toLowerCase().includes(normalizedCandidate))
}

export async function getRecommendedPlans(input: PlanRecommendationInput) {
  const countyFips = input.zip ? lookupCountyByZip(input.zip) : null

  const plans = await prisma.plan.findMany({
    where: {
      ...(input.state ? { state: input.state } : {}),
      ...(input.metalTier ? { metalTier: input.metalTier } : {}),
      ...(input.planType ? { planType: input.planType } : {}),
      ...(typeof input.maxMonthlyPremium === 'number'
        ? {
            monthlyPremium: {
              lte: input.maxMonthlyPremium,
            },
          }
        : {}),
    },
    take: 50,
    orderBy: [
      { monthlyPremium: 'asc' },
      { deductible: 'asc' },
    ],
  })

  const rankedPlans = plans
    .map((plan) => {
      const matchReasons: string[] = []
      let score = 0

      if (countyFips) {
        matchReasons.push(`ZIP resolves to county ${countyFips}`)
        score += 2
      }

      if (input.medications?.length) {
        const medicationMatches = input.medications.filter((medication) =>
          includesNormalized(plan.formulary as unknown[], medication),
        )

        if (medicationMatches.length) {
          score += medicationMatches.length * 5
          matchReasons.push(`Matches ${medicationMatches.length} medication(s) on formulary`)
        }
      }

      if (input.providers?.length) {
        const providerMatches = input.providers.filter((provider) =>
          includesNormalized(plan.providerNetwork as unknown[], provider),
        )

        if (providerMatches.length) {
          score += providerMatches.length * 6
          matchReasons.push(`Matches ${providerMatches.length} provider(s) in network`)
        }
      }

      if (!matchReasons.length) {
        matchReasons.push('Matches selected plan filters')
      }

      const explanation = countyFips
        ? `This option is being ranked for county ${countyFips} and your selected coverage filters.`
        : 'This option is being ranked from your selected coverage filters.'

      return {
        ...plan,
        score,
        countyFips,
        matchReasons,
        explanation,
      } satisfies RankedPlan
    })
    .sort((left, right) => right.score - left.score || left.monthlyPremium - right.monthlyPremium)

  return rankedPlans
}
