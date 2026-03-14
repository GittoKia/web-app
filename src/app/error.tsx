'use client'

export default function GlobalError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-10">
      <div className="surface-panel w-full max-w-lg rounded-[28px] p-8 text-center">
        <p className="section-eyebrow text-steel">Unexpected error</p>
        <h1 className="mt-2 font-display italic text-[28px] leading-[1.2] text-charcoal">
          Something went wrong
        </h1>
        <p className="mt-4 font-sans text-[14px] leading-6 text-steel">
          The page hit a problem and could not finish loading.
        </p>
        <p className="mt-3 font-sans text-[12px] leading-[1.6] text-coral break-words">
          {error.message}
        </p>
      </div>
    </div>
  )
}
