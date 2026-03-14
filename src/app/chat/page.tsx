import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { SurfaceCard } from '@/components/ui/layout-shell'

export default async function ChatPage() {
  const session = await auth()
  const cookieStore = await cookies()
  const isGuest = cookieStore.get('guest')?.value === '1'
  const visitorLabel = session?.user?.email ?? (isGuest ? 'Guest session' : 'Caregiver')

  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <SurfaceCard className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="section-eyebrow text-steel">Chat workspace</p>
            <h1 className="font-playfair text-[32px] italic leading-tight text-charcoal">
              Your support space is ready.
            </h1>
            <p className="font-sans text-[15px] leading-7 text-steel">
              Signed in as <span className="font-medium text-charcoal">{visitorLabel}</span>.
              This placeholder page confirms the new auth flow can route people into the protected app shell.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-tan bg-cream p-4">
              <p className="font-sans text-[13px] font-medium text-charcoal">Auth status</p>
              <p className="mt-2 font-sans text-[14px] leading-6 text-steel">
                {session?.user ? 'Authenticated with NextAuth session.' : 'Guest access via local guest cookie.'}
              </p>
            </div>
            <div className="rounded-card border border-tan bg-cream p-4">
              <p className="font-sans text-[13px] font-medium text-charcoal">Profile flow</p>
              <p className="mt-2 font-sans text-[14px] leading-6 text-steel">
                Onboarding can now persist profile data through Prisma-backed API routes.
              </p>
            </div>
            <div className="rounded-card border border-tan bg-cream p-4">
              <p className="font-sans text-[13px] font-medium text-charcoal">Next build step</p>
              <p className="mt-2 font-sans text-[14px] leading-6 text-steel">
                Replace this placeholder with the real care guidance and AI conversation experience.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/onboarding" className="btn-primary flex items-center justify-center sm:max-w-[220px]">
              Review onboarding
            </Link>
            <Link href="/" className="btn-secondary flex items-center justify-center sm:max-w-[220px]">
              Back to home
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </main>
  )
}
