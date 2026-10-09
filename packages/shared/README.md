# Shared Package

Gedeelde code tussen de web-, api- en ingestion-packages.

## Wat zit erin

- **Config** - AI-modellen, rate limits, retry, sessie en ingestion-instellingen
- **Types** - Gedeelde TypeScript types (Prisma-types worden re-exporteerd)
- **Validatie** - Zod schemas
- **Errors** - `ChatSDKError` en foutafhandeling
- **Doorverwijzing** - De doorverwijskanalen die systeemprompt en UI allebei gebruiken

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
import { aiConfig, rateLimitsConfig } from "@gdh-chatbot/shared/config";
import type { Message } from "@gdh-chatbot/shared/types";
import { chatRequestSchema } from "@gdh-chatbot/shared/validation";
import { DOORVERWIJZING } from "@gdh-chatbot/shared";
```
