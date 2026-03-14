import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'

export type CoverageDoc = {
  id: string
  title: string
  filePath: string
  relativePath: string
  content: string
}

export type CoverageDocChunk = {
  id: string
  docId: string
  title: string
  filePath: string
  relativePath: string
  content: string
  keywords: string[]
}

export type CoverageMatch = CoverageDocChunk & {
  score: number
}

const DOC_EXTENSIONS = new Set(['.md', '.txt'])
const DEFAULT_DOCS_ROOT = path.resolve(process.cwd(), '..', 'docs-source')

function getDocsRoot() {
  return process.env.DOCS_REPO_PATH ?? DEFAULT_DOCS_ROOT
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\u0000/g, '').trim()
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function chunkMarkdown(content: string) {
  const lines = normalizeText(content).split('\n')
  const chunks: string[] = []
  let current = ''

  for (const line of lines) {
    const nextLine = line.trimEnd()
    const isHeading = /^#{1,6}\s/.test(nextLine)
    const projected = `${current}${current ? '\n' : ''}${nextLine}`

    if ((isHeading && current.length > 500) || projected.length > 1400) {
      if (current.trim()) {
        chunks.push(current.trim())
      }
      current = nextLine
      continue
    }

    current = projected
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.filter((chunk) => chunk.length >= 120)
}

async function walkDocs(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          return walkDocs(fullPath)
        }

        return DOC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : []
      }),
  )

  return files.flat()
}

export async function loadCoverageDocs() {
  const docsRoot = getDocsRoot()
  const filePaths = await walkDocs(docsRoot)

  const docs = await Promise.all(
    filePaths.map(async (filePath, index) => {
      const content = normalizeText(await fs.readFile(filePath, 'utf8'))
      const relativePath = path.relative(docsRoot, filePath)

      return {
        id: `doc-${index + 1}`,
        title: path.basename(filePath, path.extname(filePath)),
        filePath,
        relativePath,
        content,
      } satisfies CoverageDoc
    }),
  )

  return docs
}

export async function loadCoverageChunks() {
  const docs = await loadCoverageDocs()

  return docs.flatMap((doc) =>
    chunkMarkdown(doc.content).map((content, index) => ({
      id: `${doc.id}-chunk-${index + 1}`,
      docId: doc.id,
      title: doc.title,
      filePath: doc.filePath,
      relativePath: doc.relativePath,
      content,
      keywords: Array.from(new Set(tokenize(`${doc.title} ${content}`))).slice(0, 120),
    } satisfies CoverageDocChunk)),
  )
}

export async function searchCoverageDocs(query: string, topK = 5) {
  const normalizedQuery = normalizeText(query)

  if (!normalizedQuery) {
    return [] as CoverageMatch[]
  }

  const queryTokens = tokenize(normalizedQuery)
  const chunks = await loadCoverageChunks()

  const matches = chunks
    .map((chunk) => {
      const tokenMatches = queryTokens.reduce((total, token) => {
        if (chunk.keywords.includes(token)) {
          return total + 3
        }

        if (chunk.content.toLowerCase().includes(token)) {
          return total + 1
        }

        return total
      }, 0)

      const phraseBonus = chunk.content.toLowerCase().includes(normalizedQuery.toLowerCase()) ? 8 : 0
      const titleBonus = chunk.title.toLowerCase().includes(normalizedQuery.toLowerCase()) ? 10 : 0
      const score = tokenMatches + phraseBonus + titleBonus

      return {
        ...chunk,
        score,
      }
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)

  return matches
}
