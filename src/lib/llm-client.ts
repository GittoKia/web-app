import 'server-only'

import OpenAI from 'openai'
import { z } from 'zod'

const apiKey = process.env.OPENAI_API_KEY ?? 'test'
const baseURL =
  process.env.OPENAI_BASE_URL ??
  'https://api.groq.com/openai/v1'
const defaultModel = process.env.LLM_MODEL ?? 'qwen/qwen3-32b'

export const llmClient = new OpenAI({
  apiKey,
  baseURL,
})

function extractJsonObject(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    return fencedMatch[1].trim()
  }

  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')

  if (start >= 0 && end > start) {
    return content.slice(start, end + 1)
  }

  throw new Error('Model response did not contain valid JSON.')
}

export async function generateStructuredObject<T>({
  schema,
  system,
  prompt,
  model = defaultModel,
  maxTokens = 3000,
}: {
  schema: z.ZodType<T>
  system: string
  prompt: string
  model?: string
  maxTokens?: number
}) {
  const completion = await llmClient.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `${system}\nReturn only valid JSON that matches the requested schema. Do not wrap it in commentary.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  })

  const content = completion.choices[0]?.message?.content ?? ''
  const jsonText = extractJsonObject(content)
  const parsed = JSON.parse(jsonText) as unknown

  return schema.parse(parsed)
}

export async function generateChatText({
  system,
  messages,
  model = defaultModel,
  maxTokens = 1200,
}: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  maxTokens?: number
}) {
  const completion = await llmClient.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
  })

  return completion.choices[0]?.message?.content ?? ''
}
