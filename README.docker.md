# Docker Setup voor GDH Chatbot

## Database Requirements

Deze applicatie gebruikt:

-   **PostgreSQL met pgvector extensie** - voor het opslaan van chat data en document embeddings
-   **Redis** - voor caching en rate limiting

## Quick Start

### 1. Start de databases

```bash
docker compose up -d
```

Dit start:

-   PostgreSQL op `localhost:5432`
-   Redis op `localhost:6379`

### 2. Configure environment variabelen

Maak een `.env.local` bestand aan (of kopieer `.env.example`):

```bash
cp .env.example .env.local
```

Update de database URLs in `.env.local`:

```env
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/chatbot
REDIS_URL=redis://localhost:6379
```

### 3. Run database migraties

```bash
pnpm db:migrate
```

### 4. Start de applicatie

```bash
pnpm dev
```

## Database Management

### Stop de databases

```bash
docker compose down
```

### Stop en verwijder alle data

```bash
docker compose down -v
```

### View logs

```bash
# Alle services
docker compose logs -f

# Alleen PostgreSQL
docker compose logs -f postgres

# Alleen Redis
docker compose logs -f redis
```

### Drizzle Studio (Database GUI)

```bash
pnpm db:studio
```

### Connect met psql

```bash
docker compose exec postgres psql -U postgres -d chatbot
```

## Waarom pgvector?

De applicatie gebruikt pgvector omdat:

1. **Vector embeddings** - De `DocumentEmbedding` tabel slaat 3072-dimensionale vectors op voor semantic search
2. **Similarity search** - pgvector maakt efficiënte nearest-neighbor search mogelijk
3. **Native PostgreSQL** - Geen aparte vector database nodig

## Production

Voor productie raden we aan:

-   **Azure Database for PostgreSQL** met pgvector-extensie ingeschakeld
-   **Supabase** (heeft pgvector support)
-   **Neon** (heeft pgvector support)
-   Zelf-gehoste PostgreSQL met pgvector extensie

Alle bovenstaande opties hebben de pgvector extensie geïnstalleerd.
