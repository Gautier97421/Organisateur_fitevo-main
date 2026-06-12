/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimisations de production
  poweredByHeader: false,
  compress: true,
  
  // Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    remotePatterns: [],
  },
  
  // Headers de sécurité pour la production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // La Content-Security-Policy est désormais gérée dans middleware.ts
          // (CSP à nonce par requête). Ne pas la dupliquer ici : deux en-têtes
          // CSP se combineraient de façon restrictive et casseraient les scripts.
        ],
      },
    ]
  },
  
  // Désactiver les fonctionnalités non utilisées
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  
  // Optimiser les bundles
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
}

module.exports = nextConfig
