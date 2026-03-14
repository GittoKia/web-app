import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PROTECTED = ['/chat', '/insurance', '/hospitals', '/onboarding']

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  try {
    const session = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    })
    const pathname = request.nextUrl.pathname
    const isProtected = PROTECTED.some(p => pathname.startsWith(p))

    if (isProtected) {
      const isGuest = request.cookies.get('guest')?.value === '1'
      if (!session && !isGuest) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        return NextResponse.redirect(url)
      }
    }
  } catch {
    // Never crash — always let the request through
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
