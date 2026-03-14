'use client'

import { useEffect, useState } from 'react'

type Source = {
  title: string
  relativePath: string
  score: number
}

export function ChatWorkspace() {
  const [question, setQuestion] = useState('What does the Sunlife standard plan say about prescription drug coverage and major exclusions?')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [conversationId, setConversationId] = useState('')
  const [guestSessionId, setGuestSessionId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const storedConversationId = window.localStorage.getItem('carebridge.chat.conversationId')
    const storedGuestSessionId = window.localStorage.getItem('carebridge.chat.guestSessionId')
    const nextGuestSessionId = storedGuestSessionId || crypto.randomUUID()

    if (storedConversationId) {
      setConversationId(storedConversationId)
    }

    setGuestSessionId(nextGuestSessionId)
    window.localStorage.setItem('carebridge.chat.guestSessionId', nextGuestSessionId)
  }, [])

  async function handleAsk() {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      setError('Add a question first.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          guestSessionId: guestSessionId || undefined,
          messages: [{ role: 'user', content: trimmedQuestion }],
        }),
      })

      const payload = (await response.json()) as {
        answer?: string
        conversationId?: string
        error?: string
        sources?: Source[]
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to get a response.')
      }

      setAnswer(payload.answer ?? '')
      setSources(payload.sources ?? [])

      if (payload.conversationId) {
        setConversationId(payload.conversationId)
        window.localStorage.setItem('carebridge.chat.conversationId', payload.conversationId)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="surface-panel rounded-card flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="section-eyebrow text-steel">Coverage copilot</p>
          <h2 className="font-playfair text-[30px] italic leading-tight text-charcoal">
            Ask policy questions against your real source documents.
          </h2>
          <p className="font-sans text-[15px] leading-7 text-steel">
            This chat now grounds answers in the `docs-source` coverage repository and can be paired with patient medical feature extraction on the server.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-sans text-[13px] font-medium text-charcoal">Question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="input-field min-h-[180px] resize-y"
            placeholder="Ask about coverage, eligibility, exclusions, coordination of benefits, or reimbursement rules."
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={handleAsk} className="btn-primary sm:max-w-[220px]" disabled={isLoading}>
            {isLoading ? 'Thinking...' : 'Ask Carebridge'}
          </button>
          {error ? <p className="font-sans text-[14px] text-coral">{error}</p> : null}
        </div>

        <div className="rounded-card border border-tan bg-cream p-4">
          <p className="font-sans text-[13px] font-medium text-charcoal">Answer</p>
          <p className="mt-3 whitespace-pre-wrap font-sans text-[14px] leading-7 text-steel">
            {answer || 'Your answer will appear here with document-grounded guidance.'}
          </p>
        </div>
      </section>

      <aside className="surface-panel rounded-card flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <p className="section-eyebrow text-steel">Retrieved sources</p>
          <h3 className="font-playfair text-[24px] italic leading-tight text-charcoal">Grounding context</h3>
          <p className="font-sans text-[14px] leading-6 text-steel">
            Top matching documents used for the latest answer.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {sources.length ? (
            sources.map((source) => (
              <div key={`${source.relativePath}-${source.score}`} className="rounded-card border border-tan bg-cream p-4">
                <p className="font-sans text-[14px] font-medium text-charcoal">{source.title}</p>
                <p className="mt-1 font-sans text-[13px] leading-6 text-steel">{source.relativePath}</p>
                <p className="mt-2 font-sans text-[12px] uppercase tracking-[0.18em] text-steel">Match score {source.score}</p>
              </div>
            ))
          ) : (
            <div className="rounded-card border border-dashed border-tan bg-cream p-4 font-sans text-[14px] leading-6 text-steel">
              No sources yet. Ask a question to run retrieval.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
