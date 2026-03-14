import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { searchCoverageDocs } from '@/lib/coverage-docs'
import { generateChatText } from '@/lib/llm-client'
import {
  buildMedicalMlFeatures,
  medicalFeaturePipelineInputSchema,
} from '@/lib/medical-feature-pipeline'
import { lookupDrug } from '@/lib/rxnorm-client'
import { searchProviders, normalizeProvider } from '@/lib/npi-registry'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const chatModelName = process.env.CARE_CHAT_MODEL ?? process.env.LLM_MODEL ?? 'openai/gpt-oss-120b'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})

const chatSchema = z.object({
  conversationId: z.string().optional(),
  guestSessionId: z.string().optional(),
  messages: z.array(messageSchema).min(1),
  patientContext: medicalFeaturePipelineInputSchema.optional(),
})

function getLatestUserMessage(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
}

function formatCoverageContext(
  matches: Array<{ title: string; relativePath: string; content: string; score: number }>,
) {
  if (!matches.length) {
    return 'No matching coverage documents were found.'
  }

  return matches
    .map(
      (match, index) =>
        `Source ${index + 1}: ${match.title} (${match.relativePath})\nScore: ${match.score}\n${match.content.slice(0, 1800)}`,
    )
    .join('\n\n')
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is required.' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = chatSchema.safeParse(body)
  const session = await auth()

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid chat payload.' }, { status: 400 })
  }

  const latestUserMessage = getLatestUserMessage(parsed.data.messages)

  // Run coverage search and medical features in parallel
  const [coverageMatches, medicalFeatures] = await Promise.all([
    searchCoverageDocs(latestUserMessage, 5).catch(() => []),
    parsed.data.patientContext
      ? buildMedicalMlFeatures(parsed.data.patientContext).catch(() => null)
      : Promise.resolve(null),
  ])

  const medicalExtractionJson = medicalFeatures?.extraction
  const medicalFeatureJson = medicalFeatures?.features

  // Enrich with live API data when the message mentions drugs or providers
  const liveContext = await buildLiveContext(latestUserMessage)

  let text: string
  try {
    text = await generateChatText({
      model: chatModelName,
      system:
        [
          'You are CareBridge, a healthcare coverage support assistant.',
          'You have access to live data from official US healthcare APIs (CMS, NPI Registry, RxNorm, OpenFDA).',
          'Answer using the live API data and retrieved coverage documents.',
          'Be explicit when information is missing.',
          'Do not claim a benefit is covered unless the source context supports it.',
          'Keep answers practical and readable.',
          'When referencing drug information, note that it comes from RxNorm/FDA databases.',
          'When referencing provider information, note that it comes from the NPI Registry.',
          '',
          'Retrieved coverage context:',
          formatCoverageContext(coverageMatches),
          '',
          liveContext ? `Live API data:\n${liveContext}` : '',
          '',
          'Optional medical feature context:',
          medicalFeatures
            ? JSON.stringify(
                {
                  extraction: medicalFeatures.extraction,
                  features: medicalFeatures.features,
                },
                null,
                2,
              )
            : 'No patient-specific medical feature context provided.',
        ].filter(Boolean).join('\n'),
      messages: parsed.data.messages,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM request failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  let conversationId: string | null = null

  try {
    const conversation = await prisma.chatConversation.upsert({
      where: {
        id: parsed.data.conversationId ?? '__new_conversation__',
      },
      update: {
        latestQuestion: latestUserMessage,
        latestAnswer: text,
        title: latestUserMessage.slice(0, 80) || 'Coverage support chat',
        metadata: {
          sourceCount: coverageMatches.length,
        },
        medicalExtraction: medicalExtractionJson,
        medicalFeatures: medicalFeatureJson,
      },
      create: {
        userId: session?.user?.id ?? null,
        guestSessionId: parsed.data.guestSessionId ?? null,
        title: latestUserMessage.slice(0, 80) || 'Coverage support chat',
        latestQuestion: latestUserMessage,
        latestAnswer: text,
        metadata: {
          sourceCount: coverageMatches.length,
        },
        medicalExtraction: medicalExtractionJson,
        medicalFeatures: medicalFeatureJson,
      },
    }).catch(async () => {
      return prisma.chatConversation.create({
        data: {
          userId: session?.user?.id ?? null,
          guestSessionId: parsed.data.guestSessionId ?? null,
          title: latestUserMessage.slice(0, 80) || 'Coverage support chat',
          latestQuestion: latestUserMessage,
          latestAnswer: text,
          metadata: {
            sourceCount: coverageMatches.length,
          },
          medicalExtraction: medicalExtractionJson,
          medicalFeatures: medicalFeatureJson,
        },
      })
    })

    conversationId = conversation.id

    await prisma.$transaction(async (tx) => {
      const existingCount = await tx.chatMessage.count({
        where: {
          conversationId: conversation.id,
        },
      })

      if (parsed.data.messages.length > 0) {
        await tx.chatMessage.createMany({
          data: parsed.data.messages.map((message, index) => ({
            conversationId: conversation.id,
            role: message.role,
            content: message.content,
            sequence: existingCount + index + 1,
          })),
        })
      }

      await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: text,
          sequence: existingCount + parsed.data.messages.length + 1,
        },
      })

      if (coverageMatches.length > 0) {
        await tx.chatRetrievalHit.createMany({
          data: coverageMatches.map((match) => ({
            conversationId: conversation.id,
            title: match.title,
            relativePath: match.relativePath,
            score: Math.round(match.score),
            excerpt: match.content.slice(0, 1200),
            metadata: {
              filePath: match.filePath,
              chunkId: match.id,
            },
          })),
        })
      }
    })
  } catch {
    // Database persistence failed — still return the LLM answer
  }

  return NextResponse.json({
    ok: true,
    conversationId,
    answer: text,
    sources: coverageMatches.map((match) => ({
      title: match.title,
      relativePath: match.relativePath,
      score: match.score,
    })),
    medicalFeatures: medicalFeatures?.features ?? null,
  })
}

/**
 * Detect drug names and provider references in the user message,
 * then fetch live data from RxNorm/OpenFDA and NPI Registry.
 */
async function buildLiveContext(message: string): Promise<string> {
  const parts: string[] = []
  const lowerMsg = message.toLowerCase()

  // Common drug keywords that suggest the user is asking about a medication
  const drugPatterns = /\b(medication|drug|prescription|medicine|taking|dosage|side effect|interaction|generic|brand)\b/i
  const providerPatterns = /\b(doctor|provider|physician|specialist|dentist|clinic|hospital|Dr\.?\s+\w+|NPI)\b/i

  // Extract potential drug names — look for capitalized words near drug keywords
  if (drugPatterns.test(message)) {
    const potentialDrugs = extractDrugNames(message)

    if (potentialDrugs.length > 0) {
      const drugResults = await Promise.all(
        potentialDrugs.slice(0, 3).map((name) =>
          lookupDrug(name).catch(() => null)
        )
      )

      const validResults = drugResults.filter(Boolean)
      if (validResults.length > 0) {
        parts.push('Drug information from RxNorm/FDA:')
        for (const drug of validResults) {
          if (!drug) continue
          parts.push(`- ${drug.normalizedName}${drug.brandNames.length ? ` (brands: ${drug.brandNames.slice(0, 3).join(', ')})` : ''}`)
          if (drug.purpose) parts.push(`  Purpose: ${drug.purpose.slice(0, 300)}`)
          if (drug.interactions.length > 0) {
            parts.push(`  Known interactions: ${drug.interactions.slice(0, 3).map((i) => i.description.slice(0, 150)).join('; ')}`)
          }
        }
      }
    }
  }

  // Extract provider references
  if (providerPatterns.test(message)) {
    const drMatch = message.match(/Dr\.?\s+(\w+)\s+(\w+)/i)
    if (drMatch) {
      const results = await searchProviders({
        firstName: drMatch[1],
        lastName: drMatch[2],
        limit: 3,
      }).catch(() => null)

      if (results?.results?.length) {
        parts.push('Provider information from NPI Registry:')
        for (const result of results.results.slice(0, 2)) {
          const p = normalizeProvider(result)
          parts.push(`- ${p.name}${p.credential ? `, ${p.credential}` : ''} — ${p.specialty ?? 'General Practice'}`)
          if (p.address) {
            parts.push(`  Location: ${p.address.city}, ${p.address.state} ${p.address.zip}${p.address.phone ? ` | Phone: ${p.address.phone}` : ''}`)
          }
        }
      }
    }
  }

  return parts.join('\n')
}

/**
 * Simple heuristic to extract potential drug names from a message.
 */
function extractDrugNames(message: string): string[] {
  const commonDrugs = [
    'metformin', 'lisinopril', 'amlodipine', 'metoprolol', 'omeprazole',
    'simvastatin', 'losartan', 'albuterol', 'gabapentin', 'hydrochlorothiazide',
    'atorvastatin', 'levothyroxine', 'amoxicillin', 'azithromycin', 'ibuprofen',
    'acetaminophen', 'prednisone', 'fluticasone', 'montelukast', 'escitalopram',
    'sertraline', 'duloxetine', 'bupropion', 'trazodone', 'alprazolam',
    'insulin', 'warfarin', 'eliquis', 'xarelto', 'jardiance', 'ozempic',
    'humira', 'enbrel', 'advair', 'symbicort', 'lantus', 'trulicity',
  ]

  const words = message.split(/[\s,;.()]+/)
  const found: string[] = []

  for (const word of words) {
    const lower = word.toLowerCase()
    if (commonDrugs.includes(lower)) {
      found.push(word)
    }
  }

  // Also capture capitalized words that might be drug names (2+ chars, not common English)
  const commonEnglish = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its',
    'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'let', 'say', 'she',
    'too', 'use', 'what', 'about', 'could', 'make', 'like', 'just', 'over', 'such',
    'take', 'than', 'them', 'very', 'when', 'come', 'been', 'have', 'from', 'with',
    'will', 'each', 'which', 'their', 'said', 'does', 'plan', 'plans', 'drug', 'drugs',
    'doctor', 'medication', 'taking', 'prescription', 'coverage', 'insurance', 'health',
    'medical', 'care', 'cost', 'price', 'generic', 'brand', 'side', 'effect', 'dose',
  ])

  const capitalizedPattern = /\b[A-Z][a-z]{2,}\b/g
  let match: RegExpExecArray | null
  while ((match = capitalizedPattern.exec(message)) !== null) {
    if (!commonEnglish.has(match[0].toLowerCase()) && !found.includes(match[0])) {
      found.push(match[0])
    }
  }

  return [...new Set(found)].slice(0, 5)
}
