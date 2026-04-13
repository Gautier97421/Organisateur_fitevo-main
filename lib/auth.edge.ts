import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  providers: [],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAdminPage = nextUrl.pathname.startsWith('/admin')

      if (isOnAdminPage) {
        return isLoggedIn
      }
      return true
    },
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

export const { auth } = NextAuth(authConfig)
