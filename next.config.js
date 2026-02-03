/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimisations de production
  poweredByHeader: false,
  compress: true,
  
  // Optimisation des images
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [],
  },
  
  // Optimisation du build
  swcMinify: true,
  
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
