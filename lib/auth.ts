import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const bcrypt = await import('bcryptjs')
        const { PrismaClient } = await import('../prisma/generated/prisma/client')
        const { PrismaPg } = await import('@prisma/adapter-pg')

        const adapter = new PrismaPg({
          connectionString: process.env.DATABASE_URL,
        })
        const prisma = new PrismaClient({ adapter })

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          })

          if (!user || !user.active) {
            return null
          }

          if (!user.password) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password,
          )

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            roleId: user.roleId,
            isSuperAdmin: user.role === 'superadmin',
          }
        } finally {
          await prisma.$disconnect()
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.roleId = user.roleId
        token.isSuperAdmin = user.isSuperAdmin
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.roleId = token.roleId as string | null
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
