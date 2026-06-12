import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthInterceptor } from "@/components/auth/auth-interceptor"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Gestionnaire Salle de Sport",
  description: "Système de gestion pour salles de sport",
  icons: {
    icon: [
      { url: '/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon_io/favicon.ico' },
    ],
    apple: '/favicon_io/apple-touch-icon.png',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Nonce CSP injecté par le middleware ; transmis à next-themes pour que son
  // script anti-flash inline ne soit pas bloqué par la CSP stricte.
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans bg-gray-50">
        <AuthInterceptor />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange nonce={nonce}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
