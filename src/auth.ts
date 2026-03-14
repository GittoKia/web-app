import bcrypt from 'bcryptjs'
import NextAuth, { type DefaultSession } from 'next-auth'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
  }
}

const providers = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : []),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
    ? [
        Apple({
          clientId: process.env.AUTH_APPLE_ID,
          clientSecret: process.env.AUTH_APPLE_SECRET,
        }),
      ]
    : []),
  Credentials({
    name: 'Email and password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : ''
      const password = typeof credentials?.password === 'string' ? credentials.password : ''

      if (!email || !password) {
        return null
      }

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user?.passwordHash) {
        return null
      }

      const isValid = await bcrypt.compare(password, user.passwordHash)

      if (!isValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    },
  }),
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth',
  },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id
      }

      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }

      return session
    },
  },
})
