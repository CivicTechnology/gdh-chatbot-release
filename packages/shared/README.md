# Shared Package

Gedeelde code tussen de web en api packages.

## Wat zit erin

- **Database schema** - Drizzle ORM schema en queries
- **AI tools** - RAG tools (searchDocuments, searchRelevantLinks, etc.)
- **Types** - Gedeelde TypeScript types
- **Validatie** - Zod schemas
- **Errors** - Error handling utilities

## Build

Dit package moet gebuild worden voordat andere packages het kunnen gebruiken:

```bash
# Vanuit monorepo root
bun build:shared

# Of vanuit deze directory
bun build
```

## Imports

```typescript
// Database
import { initializeDatabase } from '@gdh-chatbot/shared/db';

// AI tools
import { searchDocuments, initializeEmbeddings } from '@gdh-chatbot/shared/ai';

// Types
import type { Message } from '@gdh-chatbot/shared/types';

// Validatie
import { chatRequestSchema } from '@gdh-chatbot/shared/validation';
```

## Initialisatie

De database en embeddings moeten geinitialiseerd worden voordat ze gebruikt kunnen worden:

```typescript
import { initializeDatabase } from '@gdh-chatbot/shared/db';
import { initializeEmbeddings } from '@gdh-chatbot/shared/ai';

// Database connectie opzetten
initializeDatabase(process.env.POSTGRES_URL!);

// Embeddings initialiseren (voor RAG)
initializeEmbeddings(process.env.OPENAI_API_KEY!);
```
