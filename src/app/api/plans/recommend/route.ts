import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MetalTier, PlanType } from '@/generated/prisma'
import { getRecommendedPlans } from '@/lib/plan-recommendations'

export const runtime = 'nodejs'

const schema = z.object({
  state: z.string().optional(),
  zip: z.string().optional(),
  metalTier: z.nativeEnum(MetalTier).optional(),
  planType: z.nativeEnum(PlanType).optional(),
  medications: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional(),
  maxMonthlyPremium: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid recommendation payload.' }, { status: 400 })
  }

  const plans = await getRecommendedPlans(parsed.data)

  return NextResponse.json({
    ok: true,
    plans: plans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      name: plan.name,
      carrier: plan.carrier,
      state: plan.state,
      metalTier: plan.metalTier,
      planType: plan.planType,
      monthlyPremium: plan.monthlyPremium,
      deductible: plan.deductible,
      maxOutOfPocket: plan.maxOutOfPocket,
      score: plan.score,
      countyFips: plan.countyFips,
      matchReasons: plan.matchReasons,
      explanation: plan.explanation,
    })),
  })
}
