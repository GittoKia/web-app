'use client'

export default function GlobalError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <h1 className="font-display italic text-[28px] leading-[1.2] text-charcoal">
        Something went wrong
      </h1>
      <p className="mt-4 font-sans text-[13px] leading-[1.4] text-coral">
        {error.message}
      </p>
    </div>
  )
}
