# API Package

Express.js API server voor de GDH Chatbot.

## Tech Stack

- **Express.js** - Web framework
- **Prisma ORM** - Database queries (PostgreSQL met pgvector + PostGIS)
- **AI SDK** - Chat streaming, tools en embeddings (Azure OpenAI of OpenAI, zie `AI_PROVIDER`)
- **Sessie-auth** - httpOnly cookies; beheerders loggen in via Entra ID SSO of lokaal met wachtwoord + TOTP

## Development

```bash
# Vanuit monorepo root
bun dev:api

# Of vanuit deze directory
bun dev
```

De API draait op `http://localhost:3001` (instelbaar via `PORT`).

## Build & Start

```bash
bun build
bun start
```

## Database

```bash
bun db:generate    # Prisma Client genereren
bun db:migrate     # Migraties uitvoeren
bun db:studio      # Prisma Studio openen
bun db:push        # Schema direct pushen (development)
```

Losse scripts:

```bash
bun seed:subsidies        # Voorbeeld-regelingen + beheerder (lokaal/demo)
bun cron:expire           # Verlopen regelingen op VERLOPEN zetten
bun cron:dead-links # Bron-URLs van actieve regelingen controleren
bun calibrate:threshold   # Retrieval-drempel van de subsidie-zoektool herijken
```

## Environment Variabelen

Zie `.env.example` in deze map en in de monorepo root. De volledige lijst met validatie staat in `src/config/index.ts`.

## API Endpoints

| Endpoint | Beschrijving |
|----------|--------------|
| `POST /api/chat` | Chat streaming (SSE) |
| `GET /api/history` | Chat geschiedenis |
| `GET/PATCH /api/feedback` | Duim-feedback op antwoorden |
| `POST /api/files/upload` | Bestand uploaden |
| `POST /api/retrieval/v1/search` | Document search |
| `GET /api/auth/*` | Login, sessie, Entra ID SSO, MFA |
| `/api/admin/subsidieregelingen` | Beheerportaal: regelingen (beheerder) |
| `/api/admin/cvdr-sync` | Beheerportaal: CVDR-synchronisatie (beheerder) |
| `/api/admin/feedback` | Beheerportaal: feedbackoverzicht (beheerder) |
| `GET /api/health` | Health check |

## Structuur

- `src/domains/` - Feature modules (auth, chat, feedback, subsidieregeling, cvdr-sync, ...) met controller, service, repository en routes
- `src/routes/` - Overige routes (files, retrieval, map, table)
- `src/middleware/` - Sessie, rate limiting, error handling
- `src/lib/ai/` - Systeemprompt, providers, tools en retrieval
- `src/lib/cvdr/` - CVDR-collector, AI-extractie en sync
- `src/lib/db/` - Prisma client en queries
- `scripts/` - Seed-, cron- en kalibratiescripts
