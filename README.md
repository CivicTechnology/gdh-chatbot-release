# GDH Chatbot

AI-gestuurde chatbot voor Gemeente Den Haag, gespecialiseerd in stadslandbouw, voedselbeleid en duurzaamheidsinitiatieven.

## Monorepo Structuur

Dit project is een **bun workspace monorepo** met de volgende packages:

| Package | Beschrijving |
|---------|--------------|
| `packages/web` | Vite + React frontend (TypeScript) |
| `packages/api` | Express.js API server met Prisma ORM (TypeScript) |
| `packages/shared` | Gedeelde types, utilities en AI tools |
| `packages/ingestion` | Data ingestion pipeline: TypeScript processors + Python collectors |

## Vereisten

- **Bun** 1.3+ (package manager)
- **Node.js** 18+
- **Docker** (voor lokale databases)
- **Python** 3.9+ (voor PDF/web ingestion scripts)

## Lokaal Opstarten

### 1. Databases starten

Start PostgreSQL (met pgvector) en Redis via Docker:

```bash
bun docker:up
```

### 2. Environment variabelen

Kopieer `.env.example` naar `.env.local` in de root:

```bash
# Database (lokale Docker container)
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/chatbot

# Redis (lokale Docker container)
REDIS_URL=redis://localhost:6379

# Auth (genereer met: openssl rand -base64 32)
AUTH_SECRET=jouw-gegenereerde-secret

# OpenAI API Key (voor embeddings)
OPENAI_API_KEY=sk-...
```

### 3. Dependencies installeren en database setup

```bash
bun install
bun db:migrate
```

### 4. Development server starten

```bash
# Start zowel API als Web
bun dev

# Of afzonderlijk:
bun dev:api    # Alleen API (port 3001)
bun dev:web    # Alleen Web (port 5173)
```

De web app draait op `http://localhost:5173`, de API op `http://localhost:3001`.

## Data Pipeline

De pipeline haalt documenten op, verwerkt ze en genereert embeddings voor de RAG-functionaliteit.

### Hoe het werkt

```
Bronnen (PDF/Web/CKAN) → Verwerking → Database → Embeddings → Seed Export
```

1. **Pull**: Bronnen worden opgehaald (PDFs, webpagina's, CKAN, wetgeving)
2. **Process**: OpenAI embeddings worden gegenereerd voor alle chunks
3. **Backup/Restore**: Seed data voor deployment

### Pipeline Commands

```bash
# Bekijk alle beschikbare commands
bun run ingest --help

# Volledige pipeline: pull all sources + process
bun run ingest all

# Of per stap:
bun run ingest pull pdf     # Verwerk PDF documenten
bun run ingest pull web     # Scrape webpagina's
bun run ingest pull ckan    # Sync CKAN datasets
bun run ingest pull law     # Sync Omgevingswet
bun run ingest process      # Genereer embeddings

# Pipeline met opties
bun run ingest all --skip-pdf --skip-web   # Alleen CKAN + law
bun run ingest all --force                  # Force re-import alles
```

### Data Management

```bash
bun run ingest status       # Toon document counts
bun run ingest backup       # Exporteer naar seed file
bun run ingest restore      # Importeer van seed file
bun run ingest reset --yes  # Wis alle document data
```

### Bronnen Configureren

Bronnen worden geconfigureerd in JSON bestanden:

- `packages/ingestion/config/pdf.json` - PDF documenten
- `packages/ingestion/config/web.json` - Webpagina's
- `packages/ingestion/config/ckan.json` - CKAN open data portal
- `packages/ingestion/config/law.json` - Nederlandse wetgeving (BWB)

## Database Commands

```bash
bun db:migrate      # Migraties uitvoeren
bun db:generate     # Prisma Client genereren
bun db:studio       # Prisma Studio openen (database GUI)
bun db:push         # Schema pushen naar database (development)
bun db:pull         # Schema pullen van database
```

## Docker Commands

```bash
bun docker:up       # Start databases
bun docker:down     # Stop databases
bun docker:clean    # Verwijder databases en volumes
bun docker:logs     # Bekijk logs
```

## Build & Test

```bash
bun build           # Build alle packages
bun typecheck       # TypeScript type checking
bun lint            # Biome linting
bun test            # Playwright E2E tests
```

## Tech Stack

- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, Better Auth, Prisma ORM
- **Database**: PostgreSQL met pgvector + PostGIS, Redis
- **AI**: AI SDK, OpenAI embeddings
- **Data Processing**: Python (Docling, BeautifulSoup), TypeScript (CKAN, wetgeving)
