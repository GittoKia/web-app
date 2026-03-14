import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { searchCoverageDocs } from '@/lib/coverage-docs'
import { generateChatText } from '@/lib/llm-client'
import {
  buildMedicalMlFeatures,
  medicalFeaturePipelineInputSchema,
} from '@/lib/medical-feature-pipeline'
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
  const coverageMatches = await searchCoverageDocs(latestUserMessage, 5)
  const medicalFeatures = parsed.data.patientContext
    ? await buildMedicalMlFeatures(parsed.data.patientContext)
    : null
  const medicalExtractionJson = medicalFeatures?.extraction
  const medicalFeatureJson = medicalFeatures?.features

  const text = await generateChatText({
    model: chatModelName,
    system:
      [
        'You are Carebridge, a healthcare coverage support assistant.',
        'Answer using the retrieved policy and coverage documents first, then use medical feature context if provided.',
        'Be explicit when information is missing.',
        'Do not claim a benefit is covered unless the source context supports it.',
        'Keep answers practical and readable.',
        'Include brief source references by filename.',
        '',
        'Retrieved coverage context:',
        formatCoverageContext(coverageMatches),
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
      ].join('\n'),
    messages: parsed.data.messages,
  })

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

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    answer: text,
    sources: coverageMatches.map((match) => ({
      title: match.title,
      relativePath: match.relativePath,
      score: match.score,
    })),
    medicalFeatures: medicalFeatures?.features ?? null,
  })
}
