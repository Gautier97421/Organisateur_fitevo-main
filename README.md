# Organisateur FitEvo

Gym management platform for FitEvo — employee scheduling, time tracking, event management, and administration.

## Prerequisites

- **Node.js** >= 20.11.1
- **npm** >= 10.0.0
- **Docker** (for the PostgreSQL database)

## Quick Start

```bash
# 1. Clone and install
git clone git@github.com:SoloDesignHQ/organisateur-fitevo.git
cd organisateur-fitevo
npm install

# 2. Environment
cp .env.example .env

# 3. Start the database
npm run dev:db

# 4. Generate Prisma client, run migrations, seed
npm run db:generate
npm run db:migrate:deploy
npm run db:seed

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type check |
| `npm run check` | Full quality check (format + lint + typecheck) |
| `npm run dev:db` | Start dev Postgres in Docker |
| `npm run dev:db:down` | Stop dev Postgres |
| `npm run dev:db:reset` | Reset dev database (destroy volumes) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create and apply new migration |
| `npm run db:migrate:deploy` | Apply pending migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run setup` | Full setup (db + generate + migrate + seed) |

## Environment Variables

See [`.env.example`](.env.example) for all variables with documentation.

## Docker

### Development

```bash
npm run dev:db        # Postgres only (Next.js runs on host)
npm run dev
```

### Production

```bash
docker compose up -d  # Full stack: web + db + backup
```

The production stack includes:
- **web**: Pre-built image from GHCR with security hardening (read-only filesystem, no-new-privileges, cap_drop ALL)
- **db**: PostgreSQL 16 with SCRAM-SHA-256 authentication
- **backup**: Automated daily pg_dump with 7-day retention

## Tech Stack

- **Next.js** 16 (App Router, standalone output)
- **React** 19
- **TypeScript** 5.9 (strict mode)
- **Prisma** 7 (PostgreSQL, driver adapters)
- **Tailwind CSS** 4
- **NextAuth** v5 (JWT, Edge middleware)
- **Shadcn/ui** + Radix UI
- **ESLint** 9 + Prettier

## CI/CD

GitHub Actions pipeline on push/PR to `main`:
1. **CI**: lint, typecheck, build
2. **CD**: Docker build + push to GHCR (main only)
