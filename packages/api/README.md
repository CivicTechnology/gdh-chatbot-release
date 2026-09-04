# API Package

Express.js API server voor de GDH Chatbot.

## Tech Stack

- **Express.js** - Web framework
- **Better Auth** - Authenticatie
- **Prisma ORM** - Database queries
- **AI SDK** - AI streaming

## Development

```bash
# Vanuit monorepo root
bun dev:api

# Of vanuit deze directory
bun dev
```

De API draait op `http://localhost:3001`.

## Build & Start

```bash
bun build
bun start
```

## Database

De API beheert de database migraties:

```bash
bun db:generate    # Nieuwe migratie maken na schema wijziging
bun db:migrate     # Migraties uitvoeren
bun db:studio      # Drizzle Studio openen
bun db:push        # Schema direct pushen (development)
```

## Environment Variabelen

```bash
# Database
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/chatbot

# Redis (voor rate limiting en caching)
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET=jouw-secret
BETTER_AUTH_URL=http://localhost:3001

# AI
OPENAI_API_KEY=sk-...

# Frontend URL (voor CORS)
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

| Endpoint | Beschrijving |
|----------|--------------|
| `POST /api/chat` | Chat streaming (SSE) |
| `GET /api/history` | Chat geschiedenis |
| `POST /api/files/upload` | Bestand uploaden |
| `POST /api/retrieval/v1/search` | Document search |
| `GET /api/health` | Health check |

## Structuur

- `src/routes/` - API route definities
- `src/controllers/` - Request handlers
- `src/middleware/` - Auth, error handling, rate limiting
- `src/auth/` - Better Auth configuratie
- `src/lib/` - Database en utilities
