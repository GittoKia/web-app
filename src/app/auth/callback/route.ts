import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.redirect(`${origin}/auth?error=no_session`)
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  return NextResponse.redirect(`${origin}${profile ? '/chat' : '/onboarding'}`)
}
