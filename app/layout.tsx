import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: {
    default: "FitEvo",
    template: "%s | FitEvo",
  },
  description: "Gestion des salles, du personnel et de la caisse",
  applicationName: "FitEvo",
  // Outil interne : rien à faire dans un index de moteur de recherche.
  robots: { index: false, follow: false },
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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange nonce={nonce}>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
