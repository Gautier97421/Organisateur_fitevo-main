import nextConfig from 'eslint-config-next'
import prettier from 'eslint-config-prettier'

const config = [
  {
    ignores: ['**/.next/**', '**/node_modules/**', '**/prisma/generated/**'],
  },
  ...nextConfig,
  prettier,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
]

export default config
