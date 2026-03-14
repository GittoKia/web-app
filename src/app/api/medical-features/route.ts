import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import {
  buildMedicalMlFeatures,
  medicalFeaturePipelineInputSchema,
} from '@/lib/medical-feature-pipeline'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  try {
    const validatedInput = medicalFeaturePipelineInputSchema.parse(body)
    const result = await buildMedicalMlFeatures(validatedInput)

    return NextResponse.json({
      ok: true,
      sourceCount: result.sourceEntries.length,
      extraction: result.extraction,
      features: result.features,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid medical feature payload.',
          issues: error.issues,
        },
        { status: 400 },
      )
    }

    const message = error instanceof Error ? error.message : 'Failed to build medical features.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
