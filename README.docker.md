# Docker Setup voor GDH Chatbot

## Database Requirements

Deze applicatie gebruikt:

-   **PostgreSQL met pgvector en PostGIS** - voor chat data, document embeddings en CKAN-geodata
-   **Redis** (optioneel) - voor hervatbare chat streams

## Quick Start

### 1. Start de databases

```bash
bun docker:up
```

Dit start PostgreSQL en Redis. De hostpoorten staan in `docker-compose.yml` en zijn te overschrijven met `POSTGRES_HOST_PORT` en `REDIS_HOST_PORT`.

### 2. Configure environment variabelen

Maak een `.env.local` bestand aan (of kopieer `.env.example`):

```bash
cp .env.example .env.local
```

Zet de database URLs in `.env.local` op de poorten uit `docker-compose.yml`.

### 3. Run database migraties

```bash
bun db:migrate
```

### 4. Start de applicatie

```bash
bun dev
```

## Database Management

```bash
bun docker:down       # Stop de databases
bun docker:clean      # Stop en verwijder alle data
bun docker:logs       # Logs van alle services
bun db:studio         # Prisma Studio (database GUI)
docker compose exec postgres psql -U postgres -d chatbot   # psql
```

## Waarom pgvector?

1. **Vector embeddings** - `DocumentEmbedding` en `SubsidieRegeling` slaan embeddings op voor semantic search
2. **Similarity search** - pgvector maakt efficiënte nearest-neighbor search mogelijk
3. **Native PostgreSQL** - Geen aparte vector database nodig

## Production

Productie draait op **Azure Database for PostgreSQL** met de extensies `vector` en `postgis` ingeschakeld. Zie `deploy-templates/README.md` voor de volledige deploy-instructies.
