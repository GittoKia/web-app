import { NextResponse } from 'next/server'
import { z } from 'zod'
import { searchCoverageDocs } from '@/lib/coverage-docs'

export const runtime = 'nodejs'

const searchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = searchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search payload.' }, { status: 400 })
  }

  const matches = await searchCoverageDocs(parsed.data.query, parsed.data.topK ?? 5)

  return NextResponse.json({
    ok: true,
    matches: matches.map((match) => ({
      id: match.id,
      title: match.title,
      relativePath: match.relativePath,
      score: match.score,
      excerpt: match.content.slice(0, 700),
    })),
  })
}
